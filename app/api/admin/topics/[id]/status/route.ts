import { TopicStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_ACTIONS = ["LOCK", "REOPEN", "CANCEL"] as const;
type TopicAction = (typeof ALLOWED_ACTIONS)[number];

export async function PATCH(req: NextRequest, { params }: Params) {
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
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").toUpperCase() as TopicAction;

  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid action" }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          resolution: { select: { id: true } },
        },
      });

      if (!topic) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      if ((action === "REOPEN" || action === "CANCEL") && (topic.status === "RESOLVED" || topic.resolution)) {
        throw new Error(action === "REOPEN" ? "RESOLVED_TOPIC_REOPEN_BLOCKED" : "RESOLVED_TOPIC_CANCEL_BLOCKED");
      }

      const nextStatus: TopicStatus = action === "LOCK" ? "LOCKED" : action === "REOPEN" ? "OPEN" : "CANCELED";

      let refundedBetCount = 0;
      let refundedAmount = 0;

      if (action === "CANCEL") {
        const unsettledBets = await tx.bet.findMany({
          where: { topicId: id, settled: false },
          select: { id: true, userId: true, amount: true },
        });

        for (const bet of unsettledBets) {
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              settled: true,
              payoutAmount: bet.amount,
            },
          });

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
              note: `Topic canceled refund for topic:${id}`,
            },
          });

          refundedBetCount += 1;
          refundedAmount += bet.amount;
        }
      }

      const updatedTopic = await tx.topic.update({
        where: { id },
        data: { status: nextStatus },
        select: { id: true, status: true, updatedAt: true },
      });

      return {
        topic: updatedTopic,
        refundSummary: action === "CANCEL" ? { refundedBetCount, refundedAmount } : null,
      };
    });

    return NextResponse.json({ ok: true, data: result, error: null });
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

    return NextResponse.json({ ok: false, data: null, error: "토픽 상태 변경 실패" }, { status: 500 });
  }
}
