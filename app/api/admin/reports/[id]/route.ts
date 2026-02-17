import { ReportStatus, TopicStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LocalReportStatus, localUpdateReportStatus } from "@/lib/report-local";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"];
const ALLOWED_TOPIC_ACTIONS = ["KEEP", "LOCK", "CANCEL", "REOPEN"] as const;

type TopicAction = (typeof ALLOWED_TOPIC_ACTIONS)[number];

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const report = await db.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, nickname: true, email: true } },
      topic: { select: { id: true, title: true, status: true } },
      comment: { select: { id: true, content: true, isHidden: true } },
    },
  });

  if (!report) {
    return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: report, error: null });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const body = await req.json();
  const status = String(body.status ?? "").toUpperCase() as ReportStatus;
  const commentVisibility = String(body.commentVisibility ?? "KEEP").toUpperCase() as "KEEP" | "HIDE" | "UNHIDE";
  const topicAction = String(body.topicAction ?? "KEEP").toUpperCase() as TopicAction;

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid status" }, { status: 400 });
  }

  if (!["KEEP", "HIDE", "UNHIDE"].includes(commentVisibility)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid commentVisibility" }, { status: 400 });
  }

  if (!ALLOWED_TOPIC_ACTIONS.includes(topicAction)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid topicAction" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    if (topicAction !== "KEEP") {
      return NextResponse.json(
        { ok: false, data: null, error: "topicAction requires DATABASE_URL" },
        { status: 503 },
      );
    }

    const report = await localUpdateReportStatus({
      id,
      status: status as LocalReportStatus,
      commentVisibility,
    });
    if (!report) {
      return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: report, error: null });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) return null;

      let refundedBetCount = 0;
      let refundedAmount = 0;

      await tx.report.update({
        where: { id },
        data: {
          status,
          reviewedAt: new Date(),
        },
      });

      if (report.commentId && commentVisibility !== "KEEP") {
        await tx.comment.update({
          where: { id: report.commentId },
          data: { isHidden: commentVisibility === "HIDE" },
        });
      }

      if (report.topicId && topicAction !== "KEEP") {
        const currentTopic = await tx.topic.findUnique({
          where: { id: report.topicId },
          select: {
            id: true,
            status: true,
            resolution: { select: { id: true } },
          },
        });

        if (!currentTopic) {
          throw new Error("TOPIC_NOT_FOUND");
        }

        if (topicAction === "REOPEN" && (currentTopic.status === "RESOLVED" || currentTopic.resolution)) {
          throw new Error("RESOLVED_TOPIC_REOPEN_BLOCKED");
        }

        if (topicAction === "CANCEL" && (currentTopic.status === "RESOLVED" || currentTopic.resolution)) {
          throw new Error("RESOLVED_TOPIC_CANCEL_BLOCKED");
        }

        const nextTopicStatus: TopicStatus = topicAction === "LOCK"
          ? "LOCKED"
          : topicAction === "CANCEL"
            ? "CANCELED"
            : "OPEN";

        await tx.topic.update({
          where: { id: report.topicId },
          data: {
            status: nextTopicStatus,
          },
        });

        if (topicAction === "CANCEL") {
          const unsettledBets = await tx.bet.findMany({
            where: { topicId: report.topicId, settled: false },
            select: { id: true, userId: true, amount: true },
          });

          for (const bet of unsettledBets) {
            const existingRefundTx = await tx.walletTransaction.findFirst({
              where: {
                type: "BET_REFUND",
                relatedBetId: bet.id,
              },
              select: { id: true },
            });

            if (existingRefundTx) {
              await tx.bet.update({
                where: { id: bet.id },
                data: {
                  settled: true,
                  payoutAmount: bet.amount,
                },
              });
              continue;
            }

            const settleResult = await tx.bet.updateMany({
              where: { id: bet.id, settled: false },
              data: {
                settled: true,
                payoutAmount: bet.amount,
              },
            });

            if (settleResult.count === 0) {
              continue;
            }

            const updatedUser = await tx.user.update({
              where: { id: bet.userId },
              data: { pointBalance: { increment: bet.amount } },
              select: { pointBalance: true },
            });

            await tx.walletTransaction.create({
              data: {
                userId: bet.userId,
                type: "BET_REFUND",
                amount: bet.amount,
                balanceAfter: updatedUser.pointBalance,
                relatedBetId: bet.id,
                note: `Topic canceled refund for topic:${report.topicId}`,
              },
            });

            refundedBetCount += 1;
            refundedAmount += bet.amount;
          }
        }
      }

      const refreshed = await tx.report.findUnique({
        where: { id },
        include: {
          comment: { select: { id: true, isHidden: true } },
          topic: { select: { id: true, status: true } },
        },
      });

      if (!refreshed) return null;

      return {
        ...refreshed,
        refundSummary: topicAction === "CANCEL"
          ? {
            refundedBetCount,
            refundedAmount,
          }
          : null,
      };
    });

    if (!updated) {
      return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: updated, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    if (message === "RESOLVED_TOPIC_REOPEN_BLOCKED") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 정산 완료된 토픽은 REOPEN 할 수 없습니다." },
        { status: 409 },
      );
    }

    if (message === "RESOLVED_TOPIC_CANCEL_BLOCKED") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 정산 완료된 토픽은 CANCEL 할 수 없습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "신고 업데이트 실패" }, { status: 500 });
  }
}
