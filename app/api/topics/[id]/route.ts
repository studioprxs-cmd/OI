import { NextResponse } from "next/server";

import { getTopicPoolStatsCache, setTopicPoolStatsCache } from "@/lib/betting/pool-cache";
import { getLocalTopicInteractions } from "@/lib/local-topic-interactions";
import { findMockTopic } from "@/lib/mock-data";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    const mockTopic = findMockTopic(id);
    if (!mockTopic) {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    const local = await getLocalTopicInteractions(id);
    const yesPool = local.bets.filter((bet) => bet.choice === "YES").reduce((sum, bet) => sum + bet.amount, 0);
    const noPool = local.bets.filter((bet) => bet.choice === "NO").reduce((sum, bet) => sum + bet.amount, 0);

    const seedVotes = [
      ...Array.from({ length: mockTopic.yesVotes }, (_, index) => ({
        id: `seed-yes-${index}`,
        topicId: id,
        userId: null,
        choice: "YES",
        createdAt: new Date().toISOString(),
      })),
      ...Array.from({ length: mockTopic.noVotes }, (_, index) => ({
        id: `seed-no-${index}`,
        topicId: id,
        userId: null,
        choice: "NO",
        createdAt: new Date().toISOString(),
      })),
    ];

    const votes = [
      ...seedVotes,
      ...local.votes.map((vote) => ({
        id: vote.id,
        topicId: vote.topicId,
        userId: vote.userId,
        choice: vote.choice,
        createdAt: vote.createdAt,
      })),
    ];

    const comments = [
      ...local.comments,
      ...mockTopic.comments.map((comment) => ({
        id: comment.id,
        topicId: id,
        userId: null,
        content: comment.content,
        createdAt: comment.createdAt,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json({
      ok: true,
      data: {
        id: mockTopic.id,
        title: mockTopic.title,
        description: mockTopic.description,
        status: mockTopic.status,
        votes,
        bets: local.bets,
        comments,
        _count: {
          votes: votes.length,
          bets: local.bets.length,
          comments: comments.length,
        },
        poolStats: {
          yesPool,
          noPool,
          totalPool: yesPool + noPool,
        },
      },
      error: null,
    });
  }

  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      votes: true,
      bets: true,
      comments: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { votes: true, bets: true, comments: true } },
    },
  });

  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const cachedPoolStats = await getTopicPoolStatsCache(id);

  const liveYesPool = topic.bets.filter((bet) => bet.choice === "YES").reduce((sum, bet) => sum + bet.amount, 0);
  const liveNoPool = topic.bets.filter((bet) => bet.choice === "NO").reduce((sum, bet) => sum + bet.amount, 0);

  const poolStats = cachedPoolStats ?? (await setTopicPoolStatsCache(id, liveYesPool, liveNoPool));

  return NextResponse.json({ ok: true, data: { ...topic, poolStats }, error: null });
}
