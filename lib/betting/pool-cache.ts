import { calcPrices } from "@/lib/betting/price";

type PoolStats = {
  yesPool: number;
  noPool: number;
  totalPool: number;
  yesPrice: number;
  noPrice: number;
  cachedAt: string;
};

const CACHE_TTL_SECONDS = 10;
const CACHE_PREFIX = "oi:topic:pool:";

type MemoryEntry = { value: PoolStats; expiresAt: number };

const memoryCache = new Map<string, MemoryEntry>();

function buildKey(topicId: string) {
  return `${CACHE_PREFIX}${topicId}`;
}

function normalize(yesPool: number, noPool: number): PoolStats {
  const safeYes = Number.isFinite(yesPool) ? Math.max(0, Math.floor(yesPool)) : 0;
  const safeNo = Number.isFinite(noPool) ? Math.max(0, Math.floor(noPool)) : 0;
  const prices = calcPrices(safeYes, safeNo);

  return {
    yesPool: safeYes,
    noPool: safeNo,
    totalPool: safeYes + safeNo,
    yesPrice: prices.yesCents / 100,
    noPrice: prices.noCents / 100,
    cachedAt: new Date().toISOString(),
  };
}

function getRedisRestConfig() {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!baseUrl || !token) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
  };
}

async function redisGet(topicId: string): Promise<PoolStats | null> {
  const cfg = getRedisRestConfig();
  if (!cfg) return null;

  const key = buildKey(topicId);

  try {
    const response = await fetch(`${cfg.baseUrl}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { result?: string | null };
    if (!payload.result) return null;

    const parsed = JSON.parse(payload.result) as Partial<PoolStats>;
    if (typeof parsed.yesPool !== "number" || typeof parsed.noPool !== "number") return null;

    return normalize(parsed.yesPool, parsed.noPool);
  } catch {
    return null;
  }
}

async function redisSet(topicId: string, stats: PoolStats) {
  const cfg = getRedisRestConfig();
  if (!cfg) return;

  const key = buildKey(topicId);

  try {
    await fetch(`${cfg.baseUrl}/setex/${encodeURIComponent(key)}/${CACHE_TTL_SECONDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stats),
      cache: "no-store",
    });
  } catch {
    // best-effort cache write
  }
}

export async function getTopicPoolStatsCache(topicId: string): Promise<PoolStats | null> {
  const key = buildKey(topicId);
  const now = Date.now();
  const entry = memoryCache.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  if (entry && entry.expiresAt <= now) {
    memoryCache.delete(key);
  }

  const redisValue = await redisGet(topicId);
  if (redisValue) {
    memoryCache.set(key, { value: redisValue, expiresAt: now + (CACHE_TTL_SECONDS * 1000) });
    return redisValue;
  }

  return null;
}

export async function setTopicPoolStatsCache(topicId: string, yesPool: number, noPool: number): Promise<PoolStats> {
  const stats = normalize(yesPool, noPool);
  const key = buildKey(topicId);
  memoryCache.set(key, {
    value: stats,
    expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000),
  });

  await redisSet(topicId, stats);
  return stats;
}
