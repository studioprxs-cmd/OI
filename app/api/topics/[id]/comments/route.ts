import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localAdjustUserPoints } from "@/lib/auth-local";
import { ENGAGEMENT_POLICY } from "@/lib/engagement-policy";
import { addLocalComment, getLocalTopicInteractions } from "@/lib/local-topic-interactions";
import { findMockTopic } from "@/lib/mock-data";
import { getKstDayRange } from "@/lib/time-window";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    const mockTopic = findMockTopic(id);
    if (!mockTopic) {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    const local = await getLocalTopicInteractions(id);
    const merged = [
      ...local.comments.map((comment) => ({ ...comment, _count: { likes: 0 } })),
      ...mockTopic.comments.map((comment) => ({ ...comment, _count: { likes: 0 } })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json({ ok: true, data: merged, error: null });
  }

  const topic = await db.topic.findUnique({ where: { id }, select: { id: true } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const comments = await db.comment.findMany({
    where: { topicId: id, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      _count: { select: { likes: true } },
    },
  });

  return NextResponse.json({ ok: true, data: comments, error: null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const user = await getAuthUser(req);
  const guard = requireUser(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    const mockTopic = findMockTopic(id);
    if (!mockTopic) {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    const body = await req.json();
    const content = String(body.content ?? "").trim();
    if (!content) {
      return NextResponse.json({ ok: false, data: null, error: "content is required" }, { status: 400 });
    }

    const comment = await addLocalComment({ topicId: id, userId: user!.id, content });
    const wallet = await localAdjustUserPoints(user!.id, ENGAGEMENT_POLICY.COMMENT_REWARD_POINTS).catch(() => null);

    return NextResponse.json({
      ok: true,
      data: {
        comment,
        reward: {
          granted: true,
          amount: ENGAGEMENT_POLICY.COMMENT_REWARD_POINTS,
          reason: null,
          remainingToday: null,
        },
        pointBalance: wallet?.pointBalance ?? null,
      },
      error: null,
    }, { status: 201 });
  }

  const topic = await db.topic.findUnique({ where: { id }, select: { id: true } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const authUser = user!;
  const body = await req.json();
  const content = String(body.content ?? "").trim();

  if (!content) {
    return NextResponse.json({ ok: false, data: null, error: "content is required" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        topicId: id,
        userId: authUser.id,
        content,
      },
    });

    const { start: rewardWindowStart, end: rewardWindowEnd } = getKstDayRange();
    const rewardedCountToday = await tx.walletTransaction.count({
      where: {
        userId: authUser.id,
        type: "COMMENT_REWARD",
        createdAt: {
          gte: rewardWindowStart,
          lt: rewardWindowEnd,
        },
      },
    });

    if (rewardedCountToday >= ENGAGEMENT_POLICY.COMMENT_REWARD_DAILY_LIMIT) {
      return {
        comment,
        reward: {
          granted: false,
          amount: 0,
          reason: "COMMENT_REWARD_DAILY_LIMIT_REACHED",
          remainingToday: 0,
        },
      };
    }

    const updatedUser = await tx.user.update({
      where: { id: authUser.id },
      data: { pointBalance: { increment: ENGAGEMENT_POLICY.COMMENT_REWARD_POINTS } },
      select: { pointBalance: true },
    });

    await tx.walletTransaction.create({
      data: {
        userId: authUser.id,
        type: "COMMENT_REWARD",
        amount: ENGAGEMENT_POLICY.COMMENT_REWARD_POINTS,
        balanceAfter: updatedUser.pointBalance,
        note: `Comment reward topic:${id} comment:${comment.id}`,
      },
    });

    return {
      comment,
      reward: {
        granted: true,
        amount: ENGAGEMENT_POLICY.COMMENT_REWARD_POINTS,
        reason: null,
        remainingToday: Math.max(0, ENGAGEMENT_POLICY.COMMENT_REWARD_DAILY_LIMIT - (rewardedCountToday + 1)),
      },
    };
  });

  return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
}
