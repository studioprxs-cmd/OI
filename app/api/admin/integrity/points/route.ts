import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENGAGEMENT_POLICY } from "@/lib/engagement-policy";
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
const MAX_VOTE_REWARD_REPAIR_BATCH = 200;

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

  const latestTransactionsByUser = await db.walletTransaction.findMany({
    distinct: ["userId"],
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      userId: true,
      balanceAfter: true,
    },
  });

  const latestBalanceByUser = new Map(
    latestTransactionsByUser.map((tx) => [tx.userId, tx.balanceAfter]),
  );

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
        walletTxCount: txByUser.reduce((sum, row) => sum + row._count._all, 0),
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

async function repairMissingVoteRewards(input: {
  adminId: string;
  dryRun: boolean;
  limit: number;
}) {
  const safeLimit = Math.max(1, Math.min(MAX_VOTE_REWARD_REPAIR_BATCH, Math.floor(input.limit)));

  const votesWithoutReward = await db.$queryRaw<Array<{ id: string; userId: string }>>`
    SELECT v.id, v."userId"
    FROM "Vote" v
    LEFT JOIN "WalletTransaction" wt
      ON wt."relatedVoteId" = v.id
      AND wt.type = 'VOTE_REWARD'
    WHERE wt.id IS NULL
    ORDER BY v."createdAt" ASC
    LIMIT ${safeLimit}
  `;

  if (votesWithoutReward.length === 0) {
    return {
      repaired: 0,
      skippedDuplicate: 0,
      attempted: 0,
      dryRun: input.dryRun,
      limit: safeLimit,
      repairedVoteIds: [] as string[],
    };
  }

  if (input.dryRun) {
    return {
      repaired: 0,
      skippedDuplicate: 0,
      attempted: votesWithoutReward.length,
      dryRun: true,
      limit: safeLimit,
      previewVoteIds: votesWithoutReward.map((vote) => vote.id),
    };
  }

  let repaired = 0;
  let skippedDuplicate = 0;
  const repairedVoteIds: string[] = [];

  await db.$transaction(async (tx) => {
    for (const vote of votesWithoutReward) {
      try {
        await applyWalletDelta({
          tx,
          userId: vote.userId,
          amount: ENGAGEMENT_POLICY.VOTE_REWARD_POINTS,
          type: "VOTE_REWARD",
          relatedVoteId: vote.id,
          note: `Integrity vote reward backfill by admin:${input.adminId}`,
        });

        repaired += 1;
        repairedVoteIds.push(vote.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "UNKNOWN";
        if (message === "WALLET_TX_DUPLICATE_REFERENCE") {
          skippedDuplicate += 1;
          continue;
        }
        throw error;
      }
    }
  });

  return {
    repaired,
    skippedDuplicate,
    attempted: votesWithoutReward.length,
    dryRun: false,
    limit: safeLimit,
    repairedVoteIds,
  };
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
  const action = String(body.action ?? "reconcile-user").trim();

  if (action === "repair-missing-vote-rewards") {
    const dryRun = body.dryRun !== false;
    const limit = Number(body.limit ?? MAX_VOTE_REWARD_REPAIR_BATCH);

    try {
      const result = await repairMissingVoteRewards({
        adminId: auth.user.id,
        dryRun,
        limit,
      });

      return NextResponse.json({
        ok: true,
        data: {
          action,
          ...result,
          generatedAt: new Date().toISOString(),
        },
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

      if (message === "WALLET_BALANCE_WRITE_RACE") {
        return NextResponse.json(
          { ok: false, data: null, error: "보상 백필 중 동시성 충돌이 발생했습니다. 잠시 후 다시 시도해주세요." },
          { status: 409 },
        );
      }

      if (message === "WALLET_USER_NOT_FOUND") {
        return NextResponse.json({ ok: false, data: null, error: "투표 보상 백필 대상 사용자 정보를 찾지 못했습니다." }, { status: 404 });
      }

      return NextResponse.json({ ok: false, data: null, error: "Failed to repair missing vote rewards" }, { status: 500 });
    }
  }

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
