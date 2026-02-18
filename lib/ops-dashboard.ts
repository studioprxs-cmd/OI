import { db } from "@/lib/db";
import { getSuspiciousMultiAccountIps } from "@/lib/security/access-log";

const BET_FEE_RATE = 0.05;

const INFLATION_THRESHOLDS = {
  HEALTHY: 0.7,
  WARNING: 0.5,
} as const;

export type InflationDaySnapshot = {
  dateKey: string;
  issuedPoints: number;
  burnedPoints: number;
  netPoints: number;
};

export type InflationSnapshot = {
  days: InflationDaySnapshot[];
  totals: {
    issuedPoints: number;
    burnedPoints: number;
    netPoints: number;
    burnToIssueRatio: number;
  };
};

export type OpsIssueBurnSnapshot = {
  days: InflationDaySnapshot[];
  totals: {
    issuedPoints: number;
    burnedPoints: number;
    netPoints: number;
    burnToIssueRatio: number;
  };
};

export type MultiAccountRiskSnapshot = {
  windowDays: number;
  minUsers: number;
  suspicious: Array<{
    ip: string;
    userCount: number;
    users: string[];
    emails: string[];
    events: number;
    lastSeenAt: string;
  }>;
};

export type InflationHealthSnapshot = {
  ratio: number;
  stage: "HEALTHY" | "WARNING" | "CRITICAL";
  rewardScale: number;
  marketPolicyHint: string;
  message: string;
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getInflationSnapshot(windowDays = 7): Promise<InflationSnapshot> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const dayKeys = Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toDateKey(day);
  });

  if (!process.env.DATABASE_URL) {
    const days = dayKeys.map((dateKey) => ({ dateKey, issuedPoints: 0, burnedPoints: 0, netPoints: 0 }));
    return {
      days,
      totals: { issuedPoints: 0, burnedPoints: 0, netPoints: 0, burnToIssueRatio: 0 },
    };
  }

  const [rewardTxs, recentResolutions] = await Promise.all([
    db.walletTransaction.findMany({
      where: {
        createdAt: { gte: start },
        type: { in: ["VOTE_REWARD", "COMMENT_REWARD"] },
        amount: { gt: 0 },
      },
      select: { createdAt: true, amount: true },
      take: 20_000,
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    db.resolution.findMany({
      where: { resolvedAt: { gte: start } },
      select: {
        resolvedAt: true,
        topic: {
          select: {
            bets: { select: { amount: true } },
          },
        },
      },
      take: 5_000,
      orderBy: { resolvedAt: "desc" },
    }).catch(() => []),
  ]);

  const issuedByDay = new Map<string, number>();
  for (const tx of rewardTxs) {
    const key = toDateKey(new Date(tx.createdAt));
    issuedByDay.set(key, (issuedByDay.get(key) ?? 0) + tx.amount);
  }

  const burnedByDay = new Map<string, number>();
  for (const resolution of recentResolutions) {
    const key = toDateKey(new Date(resolution.resolvedAt));
    const totalPool = resolution.topic.bets.reduce((sum, bet) => sum + bet.amount, 0);
    const feeBurn = Math.floor(totalPool * BET_FEE_RATE);
    burnedByDay.set(key, (burnedByDay.get(key) ?? 0) + feeBurn);
  }

  const days = dayKeys.map((dateKey) => {
    const issuedPoints = issuedByDay.get(dateKey) ?? 0;
    const burnedPoints = burnedByDay.get(dateKey) ?? 0;
    return {
      dateKey,
      issuedPoints,
      burnedPoints,
      netPoints: issuedPoints - burnedPoints,
    };
  });

  const totals = days.reduce(
    (acc, day) => {
      acc.issuedPoints += day.issuedPoints;
      acc.burnedPoints += day.burnedPoints;
      acc.netPoints += day.netPoints;
      return acc;
    },
    { issuedPoints: 0, burnedPoints: 0, netPoints: 0 },
  );

  return {
    days,
    totals: {
      ...totals,
      burnToIssueRatio: totals.issuedPoints > 0 ? totals.burnedPoints / totals.issuedPoints : 0,
    },
  };
}

export async function getOpsIssueBurnSnapshot(windowDays = 14): Promise<OpsIssueBurnSnapshot> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const dayKeys = Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toDateKey(day);
  });

  if (!process.env.DATABASE_URL) {
    const days = dayKeys.map((dateKey) => ({ dateKey, issuedPoints: 0, burnedPoints: 0, netPoints: 0 }));
    return {
      days,
      totals: { issuedPoints: 0, burnedPoints: 0, netPoints: 0, burnToIssueRatio: 0 },
    };
  }

  const [walletTxs, settlements] = await Promise.all([
    db.walletTransaction
      .findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true, amount: true },
        take: 50_000,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    db.settlement
      .findMany({
        where: { settledAt: { gte: start } },
        select: { settledAt: true, feeCollected: true },
        take: 10_000,
        orderBy: { settledAt: "desc" },
      })
      .catch(() => []),
  ]);

  const issuedByDay = new Map<string, number>();
  const burnedByDay = new Map<string, number>();

  for (const tx of walletTxs) {
    const key = toDateKey(new Date(tx.createdAt));
    if (tx.amount > 0) {
      issuedByDay.set(key, (issuedByDay.get(key) ?? 0) + tx.amount);
    } else if (tx.amount < 0) {
      burnedByDay.set(key, (burnedByDay.get(key) ?? 0) + Math.abs(tx.amount));
    }
  }

  for (const settlement of settlements) {
    const key = toDateKey(new Date(settlement.settledAt));
    burnedByDay.set(key, (burnedByDay.get(key) ?? 0) + Math.max(0, settlement.feeCollected));
  }

  const days = dayKeys.map((dateKey) => {
    const issuedPoints = issuedByDay.get(dateKey) ?? 0;
    const burnedPoints = burnedByDay.get(dateKey) ?? 0;
    return {
      dateKey,
      issuedPoints,
      burnedPoints,
      netPoints: issuedPoints - burnedPoints,
    };
  });

  const totals = days.reduce(
    (acc, day) => {
      acc.issuedPoints += day.issuedPoints;
      acc.burnedPoints += day.burnedPoints;
      acc.netPoints += day.netPoints;
      return acc;
    },
    { issuedPoints: 0, burnedPoints: 0, netPoints: 0 },
  );

  return {
    days,
    totals: {
      ...totals,
      burnToIssueRatio: totals.issuedPoints > 0 ? totals.burnedPoints / totals.issuedPoints : 0,
    },
  };
}

export function evaluateInflationHealth(ratio: number): InflationHealthSnapshot {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;

  if (safeRatio >= INFLATION_THRESHOLDS.HEALTHY) {
    return {
      ratio: safeRatio,
      stage: "HEALTHY",
      rewardScale: 1,
      marketPolicyHint: "기본 보상 정책 유지",
      message: "소각/발행 비율이 안정 구간입니다. 현재 보상/마켓 정책을 유지하세요.",
    };
  }

  if (safeRatio >= INFLATION_THRESHOLDS.WARNING) {
    return {
      ratio: safeRatio,
      stage: "WARNING",
      rewardScale: 0.8,
      marketPolicyHint: "보상 20% 축소 + 마켓 소각 프로모션 확대",
      message: "주의 구간입니다. 단기 보상 강도를 낮추고 소각 유도 상품 노출을 강화하세요.",
    };
  }

  return {
    ratio: safeRatio,
    stage: "CRITICAL",
    rewardScale: 0,
    marketPolicyHint: "비핵심 보상 동결 + 긴급 소각 이벤트",
    message: "위험 구간입니다. 신규 보상 발행을 제한하고 긴급 소각 액션을 실행하세요.",
  };
}

export async function getMultiAccountRiskSnapshot(windowDays = 7, minUsers = 3): Promise<MultiAccountRiskSnapshot> {
  const safeWindowDays = Math.max(1, Math.min(30, Math.floor(windowDays)));
  const safeMinUsers = Math.max(2, Math.min(20, Math.floor(minUsers)));
  const suspicious = await getSuspiciousMultiAccountIps(safeWindowDays, safeMinUsers);

  return {
    windowDays: safeWindowDays,
    minUsers: safeMinUsers,
    suspicious,
  };
}
