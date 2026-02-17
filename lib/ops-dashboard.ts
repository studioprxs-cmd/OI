import { db } from "@/lib/db";

const BET_FEE_RATE = 0.05;

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
