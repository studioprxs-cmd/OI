import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENGAGEMENT_POLICY } from "@/lib/engagement-policy";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. comment like is disabled." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const authUser = user!;

  try {
    const result = await db.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id },
        select: { id: true, topicId: true, userId: true, isHidden: true },
      });

      if (!comment || comment.isHidden) {
        throw new Error("COMMENT_NOT_FOUND");
      }

      if (comment.userId === authUser.id) {
        throw new Error("COMMENT_SELF_LIKE_BLOCKED");
      }

      const like = await tx.commentLike.create({
        data: {
          commentId: comment.id,
          userId: authUser.id,
        },
      });

      const updatedAuthor = await tx.user.update({
        where: { id: comment.userId },
        data: { pointBalance: { increment: ENGAGEMENT_POLICY.COMMENT_LIKE_REWARD_POINTS } },
        select: { pointBalance: true },
      });

      await tx.walletTransaction.create({
        data: {
          userId: comment.userId,
          type: "COMMENT_LIKE_REWARD",
          amount: ENGAGEMENT_POLICY.COMMENT_LIKE_REWARD_POINTS,
          balanceAfter: updatedAuthor.pointBalance,
          note: `Comment like reward topic:${comment.topicId} comment:${comment.id} like:${like.id}`,
        },
      });

      const likeCount = await tx.commentLike.count({ where: { commentId: comment.id } });

      return {
        commentId: comment.id,
        topicId: comment.topicId,
        likeCount,
        reward: {
          userId: comment.userId,
          amount: ENGAGEMENT_POLICY.COMMENT_LIKE_REWARD_POINTS,
        },
      };
    });

    return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 추천한 댓글입니다." },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "COMMENT_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Comment not found" }, { status: 404 });
    }

    if (message === "COMMENT_SELF_LIKE_BLOCKED") {
      return NextResponse.json(
        { ok: false, data: null, error: "자신의 댓글은 추천할 수 없습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "댓글 추천 처리 실패" }, { status: 500 });
  }
}
