import { NextRequest, NextResponse } from "next/server";

import { Choice } from "@prisma/client";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type NotificationItem = {
  topicId: string;
  topicTitle: string;
  result: Choice;
  resolvedAt: string;
  betTotal: number;
  payoutTotal: number;
  profit: number;
  settledBetCount: number;
};

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, data: { items: [] }, error: null });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));

  const bets = await db.bet.findMany({
    where: {
      userId: user!.id,
      settled: true,
      topic: {
        status: "RESOLVED",
        resolution: {
          isNot: null,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      topicId: true,
      amount: true,
      payoutAmount: true,
      topic: {
        select: {
          title: true,
          resolution: {
            select: {
              result: true,
              resolvedAt: true,
            },
          },
        },
      },
    },
  });

  const grouped = new Map<string, NotificationItem>();

  for (const bet of bets) {
    const resolution = bet.topic.resolution;
    if (!resolution) continue;

    const prev = grouped.get(bet.topicId);
    if (prev) {
      prev.betTotal += bet.amount;
      prev.payoutTotal += Number(bet.payoutAmount ?? 0);
      prev.profit = prev.payoutTotal - prev.betTotal;
      prev.settledBetCount += 1;
      continue;
    }

    const payoutTotal = Number(bet.payoutAmount ?? 0);
    grouped.set(bet.topicId, {
      topicId: bet.topicId,
      topicTitle: bet.topic.title,
      result: resolution.result,
      resolvedAt: resolution.resolvedAt.toISOString(),
      betTotal: bet.amount,
      payoutTotal,
      profit: payoutTotal - bet.amount,
      settledBetCount: 1,
    });
  }

  const items = [...grouped.values()]
    .sort((a, b) => +new Date(b.resolvedAt) - +new Date(a.resolvedAt))
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    data: {
      items,
    },
    error: null,
  });
}
