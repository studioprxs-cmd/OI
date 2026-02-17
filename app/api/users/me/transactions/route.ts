import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: true,
        data: {
          items: [],
          page: 1,
          limit: DEFAULT_LIMIT,
          total: 0,
          hasMore: false,
        },
        error: null,
      },
      { status: 200 },
    );
  }

  const { searchParams } = new URL(req.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const typeFilter = String(searchParams.get("type") ?? "").trim();

  const where = {
    userId: user!.id,
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const [total, items] = await Promise.all([
    db.walletTransaction.count({ where }),
    db.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        relatedBetId: true,
        relatedVoteId: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
    error: null,
  });
}
