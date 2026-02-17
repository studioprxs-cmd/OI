import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

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
