import { NextResponse } from "next/server";

import { getTopicPoolStatsCache, setTopicPoolStatsCache } from "@/lib/betting/pool-cache";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

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
