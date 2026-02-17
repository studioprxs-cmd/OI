import { getTopicPoolStatsCache, setTopicPoolStatsCache } from "@/lib/betting/pool-cache";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";
import { parseTopicKindFromTitle } from "@/lib/topic";

export type OingMarketTopic = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  voteCount: number;
  betCount: number;
  commentCount: number;
  yesPool: number;
  noPool: number;
  totalPool: number;
  yesPrice: number;
  noPrice: number;
};

export type OingMarketsPayload = {
  topics: OingMarketTopic[];
  openCount: number;
  totalPool: number;
  cachedAt: string;
};

let cache: { key: string; expiresAt: number; payload: OingMarketsPayload } | null = null;

function buildWindowKey(nowMs: number) {
  const minCloseMs = nowMs + (10 * 60 * 1000);
  const maxCloseMs = nowMs + (7 * 24 * 60 * 60 * 1000);
  return `${minCloseMs}:${maxCloseMs}`;
}

export async function getOingMarkets(nowMs = Date.now()): Promise<OingMarketsPayload> {
  const cacheKey = buildWindowKey(nowMs);
  if (cache && cache.key === cacheKey && cache.expiresAt > nowMs) {
    return cache.payload;
  }

  const minCloseMs = nowMs + (10 * 60 * 1000);
  const maxCloseMs = nowMs + (7 * 24 * 60 * 60 * 1000);
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const dbTopics = canUseDb
    ? await db.topic.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          bets: { select: { choice: true, amount: true } },
          _count: { select: { votes: true, bets: true, comments: true } },
        },
      }).catch(() => [])
    : [];

  const liveCandidates = dbTopics.filter((topic) => {
    if (parseTopicKindFromTitle(topic.title) !== "BETTING") return false;
    if (topic.status !== "OPEN") return false;

    const closeMs = new Date(topic.closeAt).getTime();
    if (Number.isNaN(closeMs)) return false;
    return closeMs >= minCloseMs && closeMs <= maxCloseMs;
  });

  const liveTopics = await Promise.all(
    liveCandidates.map(async (topic) => {
      const cached = await getTopicPoolStatsCache(topic.id);
      const liveYesPool = topic.bets.filter((bet) => bet.choice === "YES").reduce((sum, bet) => sum + bet.amount, 0);
      const liveNoPool = topic.bets.filter((bet) => bet.choice === "NO").reduce((sum, bet) => sum + bet.amount, 0);
      const poolStats = cached ?? (await setTopicPoolStatsCache(topic.id, liveYesPool, liveNoPool));

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        status: topic.status,
        createdAt: topic.createdAt,
        voteCount: topic._count.votes,
        betCount: topic._count.bets,
        commentCount: topic._count.comments,
        yesPool: poolStats.yesPool,
        noPool: poolStats.noPool,
        totalPool: poolStats.totalPool,
        yesPrice: poolStats.yesPrice,
        noPrice: poolStats.noPrice,
      };
    }),
  );

  const fallbackMock = mockTopicSummaries()
    .filter((topic) => {
      if (parseTopicKindFromTitle(topic.title) !== "BETTING") return false;
      if (topic.status !== "OPEN") return false;

      const closeMs = new Date(topic.closeAt).getTime();
      if (Number.isNaN(closeMs)) return false;
      return closeMs >= minCloseMs && closeMs <= maxCloseMs;
    })
    .map((topic) => {
      const yesPool = Math.floor(topic.totalPool * 0.5);
      const noPool = topic.totalPool - yesPool;
      const totalPool = yesPool + noPool;

      return {
        ...topic,
        yesPool,
        noPool,
        yesPrice: totalPool > 0 ? yesPool / totalPool : 0.5,
        noPrice: totalPool > 0 ? noPool / totalPool : 0.5,
      };
    });

  const topics = [
    ...liveTopics,
    ...fallbackMock.filter((mock) => !liveTopics.some((topic) => topic.id === mock.id)),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const payload: OingMarketsPayload = {
    topics,
    openCount: topics.filter((topic) => topic.status === "OPEN").length,
    totalPool: topics.reduce((sum, topic) => sum + topic.totalPool, 0),
    cachedAt: new Date(nowMs).toISOString(),
  };

  cache = {
    key: cacheKey,
    payload,
    expiresAt: nowMs + 8_000,
  };

  return payload;
}
