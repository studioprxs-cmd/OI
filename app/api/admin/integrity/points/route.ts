import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyWalletDelta } from "@/lib/wallet";

type IntegrityUserRow = {
  userId: string;
  nickname: string;
  email: string;
  pointBalance: number;
  txCount: number;
  ledgerDeltaTotal: number;
  latestLedgerBalanceAfter: number | null;
  deltaVsLedgerTotal: number;
  deltaVsLatestLedger: number | null;
};

const MAX_SAMPLE_USERS = 30;
const MAX_RECENT_TX_SCAN = 5000;

async function requireAdminUser(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status }),
    };
  }

  return { ok: true as const, user: user! };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if (!auth.ok) return auth.response;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode." },
      { status: 503 },
    );
  }

  const users = await db.user.findMany({
    select: { id: true, nickname: true, email: true, pointBalance: true },
    orderBy: { createdAt: "asc" },
  });

  const txByUser = await db.walletTransaction.groupBy({
    by: ["userId"],
    _count: { _all: true },
    _sum: { amount: true },
  });

  const txTotals = new Map(
    txByUser.map((row) => [row.userId, { count: row._count._all, sum: Number(row._sum.amount ?? 0) }]),
  );

  const recentTransactions = await db.walletTransaction.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
      type: true,
      amount: true,
      balanceAfter: true,
      createdAt: true,
      relatedBetId: true,
      relatedVoteId: true,
    },
    take: MAX_RECENT_TX_SCAN,
  });

  const latestBalanceByUser = new Map<string, number>();
  for (const tx of recentTransactions) {
    if (!latestBalanceByUser.has(tx.userId)) {
      latestBalanceByUser.set(tx.userId, tx.balanceAfter);
    }
  }

  const rows: IntegrityUserRow[] = users.map((member) => {
    const tx = txTotals.get(member.id);
    const ledgerDeltaTotal = tx?.sum ?? 0;
    const txCount = tx?.count ?? 0;
    const latestLedgerBalanceAfter = latestBalanceByUser.get(member.id) ?? null;
    const deltaVsLedgerTotal = member.pointBalance - ledgerDeltaTotal;
    const deltaVsLatestLedger = latestLedgerBalanceAfter === null
      ? null
      : member.pointBalance - latestLedgerBalanceAfter;

    return {
      userId: member.id,
      nickname: member.nickname,
      email: member.email,
      pointBalance: member.pointBalance,
      txCount,
      ledgerDeltaTotal,
      latestLedgerBalanceAfter,
      deltaVsLedgerTotal,
      deltaVsLatestLedger,
    };
  });

  const driftByLedgerTotal = rows
    .filter((row) => row.deltaVsLedgerTotal !== 0)
    .sort((a, b) => Math.abs(b.deltaVsLedgerTotal) - Math.abs(a.deltaVsLedgerTotal));

  const driftByLatestLedger = rows
    .filter((row) => row.deltaVsLatestLedger !== null && row.deltaVsLatestLedger !== 0)
    .sort((a, b) => Math.abs(Number(b.deltaVsLatestLedger ?? 0)) - Math.abs(Number(a.deltaVsLatestLedger ?? 0)));

  const usersWithoutLedger = rows
    .filter((row) => row.txCount === 0 && row.pointBalance !== 0)
    .sort((a, b) => Math.abs(b.pointBalance) - Math.abs(a.pointBalance));

  const duplicateBetSettleRefs = await db.walletTransaction.groupBy({
    by: ["relatedBetId"],
    where: { type: "BET_SETTLE", relatedBetId: { not: null } },
    _count: { relatedBetId: true },
  }).then((groups) => groups.filter((group) => (group._count.relatedBetId ?? 0) > 1).length);

  const duplicateBetRefundRefs = await db.walletTransaction.groupBy({
    by: ["relatedBetId"],
    where: { type: "BET_REFUND", relatedBetId: { not: null } },
    _count: { relatedBetId: true },
  }).then((groups) => groups.filter((group) => (group._count.relatedBetId ?? 0) > 1).length);

  const duplicateVoteRewardRefs = await db.walletTransaction.groupBy({
    by: ["relatedVoteId"],
    where: { type: "VOTE_REWARD", relatedVoteId: { not: null } },
    _count: { relatedVoteId: true },
  }).then((groups) => groups.filter((group) => (group._count.relatedVoteId ?? 0) > 1).length);

  return NextResponse.json({
    ok: true,
    data: {
      summary: {
        userCount: users.length,
        walletTxCount: recentTransactions.length,
        driftByLedgerTotalCount: driftByLedgerTotal.length,
        driftByLatestLedgerCount: driftByLatestLedger.length,
        usersWithoutLedgerCount: usersWithoutLedger.length,
        duplicateRefCount: duplicateBetSettleRefs + duplicateBetRefundRefs + duplicateVoteRewardRefs,
      },
      duplicateReferences: {
        BET_SETTLE: duplicateBetSettleRefs,
        BET_REFUND: duplicateBetRefundRefs,
        VOTE_REWARD: duplicateVoteRewardRefs,
      },
      samples: {
        driftByLedgerTotal: driftByLedgerTotal.slice(0, MAX_SAMPLE_USERS),
        driftByLatestLedger: driftByLatestLedger.slice(0, MAX_SAMPLE_USERS),
        usersWithoutLedger: usersWithoutLedger.slice(0, MAX_SAMPLE_USERS),
      },
      generatedAt: new Date().toISOString(),
    },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if (!auth.ok) return auth.response;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  const apply = Boolean(body.apply);

  if (!userId) {
    return NextResponse.json({ ok: false, data: null, error: "userId is required" }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true, email: true, pointBalance: true },
  });

  if (!targetUser) {
    return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
  }

  const [ledgerAgg, latestTx] = await Promise.all([
    db.walletTransaction.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { userId },
    }),
    db.walletTransaction.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, balanceAfter: true, createdAt: true },
    }),
  ]);

  const ledgerDeltaTotal = Number(ledgerAgg._sum.amount ?? 0);
  const txCount = ledgerAgg._count._all;
  const latestLedgerBalanceAfter = latestTx?.balanceAfter ?? null;
  const expectedBalance = latestLedgerBalanceAfter ?? ledgerDeltaTotal;
  const delta = expectedBalance - targetUser.pointBalance;

  if (delta === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        userId,
        apply,
        repaired: false,
        reason: "ALREADY_IN_SYNC",
        pointBalance: targetUser.pointBalance,
        expectedBalance,
        txCount,
        latestLedgerBalanceAfter,
      },
      error: null,
    });
  }

  if (!apply) {
    return NextResponse.json({
      ok: true,
      data: {
        userId,
        apply,
        repaired: false,
        preview: {
          currentBalance: targetUser.pointBalance,
          expectedBalance,
          suggestedDelta: delta,
          txCount,
          latestLedgerBalanceAfter,
        },
      },
      error: null,
    });
  }

  try {
    const repaired = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet-user:${userId}`}))`;

      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, pointBalance: true },
      });

      if (!lockedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      const latestLedger = await tx.walletTransaction.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { balanceAfter: true },
      });

      const expectedLockedBalance = latestLedger?.balanceAfter ?? 0;
      const lockedDelta = expectedLockedBalance - lockedUser.pointBalance;

      if (lockedDelta === 0) {
        return {
          repaired: false,
          reason: "ALREADY_IN_SYNC",
          balanceAfter: lockedUser.pointBalance,
        };
      }

      const patched = await applyWalletDelta({
        tx,
        userId,
        amount: lockedDelta,
        type: "ADMIN_ADJUST",
        note: `Integrity reconcile to ledger balance by admin:${auth.user.id}`,
      });

      return {
        repaired: true,
        reason: "REPAIRED",
        deltaApplied: lockedDelta,
        balanceAfter: patched.balanceAfter,
        walletTransactionId: patched.transaction.id,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        userId,
        apply,
        ...repaired,
        generatedAt: new Date().toISOString(),
      },
      error: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
    }

    if (message === "WALLET_TX_TYPE_INVALID") {
      return NextResponse.json({ ok: false, data: null, error: "ADMIN_ADJUST transaction type is not allowed" }, { status: 500 });
    }

    if (message === "WALLET_BALANCE_WRITE_RACE") {
      return NextResponse.json(
        { ok: false, data: null, error: "포인트 정합성 복구 중 동시성 충돌이 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to reconcile user wallet integrity" }, { status: 500 });
  }
}
