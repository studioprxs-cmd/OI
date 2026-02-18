import { Choice, Prisma, TopicStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { calculateSettlement } from "@/lib/settlement";
import { applyWalletDelta } from "@/lib/wallet";

const SETTLEMENT_FEE_RATE = 0.05;
const SETTLEMENT_MAX_RETRIES = 3;
const SETTLEMENT_RETRY_DELAY_MS = 250;

const inFlightTopics = new Set<string>();

type SettlementJobInput = {
  topicId: string;
  settledById: string;
};

function ensureJobInput(input: SettlementJobInput) {
  if (!input.topicId) throw new Error("SETTLEMENT_TOPIC_ID_REQUIRED");
  if (!input.settledById) throw new Error("SETTLEMENT_SETTLER_REQUIRED");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSettlementError(message: string) {
  return [
    "WALLET_BALANCE_WRITE_RACE",
    "BET_ALREADY_SETTLED_RACE",
    "P2028",
    "P2034",
  ].some((token) => message.includes(token));
}

async function processSettlementWithRetry(input: SettlementJobInput) {
  let attempt = 0;

  while (attempt < SETTLEMENT_MAX_RETRIES) {
    attempt += 1;

    try {
      return await processSettlementJob(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "UNKNOWN";

      if (!isRetryableSettlementError(message) || attempt >= SETTLEMENT_MAX_RETRIES) {
        throw error;
      }

      await sleep(SETTLEMENT_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error("SETTLEMENT_RETRY_EXHAUSTED");
}

export async function processSettlementJob(input: SettlementJobInput) {
  ensureJobInput(input);

  const { topicId, settledById } = input;

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`resolve-topic:${topicId}`}))`;

    const topic = await tx.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        status: true,
        resolution: {
          select: {
            id: true,
            result: true,
          },
        },
        settlement: { select: { id: true } },
      },
    });

    if (!topic) throw new Error("TOPIC_NOT_FOUND");
    if (!topic.resolution) throw new Error("RESOLUTION_NOT_FOUND");
    if (topic.settlement) throw new Error("SETTLEMENT_ALREADY_PROCESSED");

    const result = topic.resolution.result as Choice;

    const unsettledBets = await tx.bet.findMany({
      where: { topicId, settled: false },
      select: { id: true, userId: true, choice: true, amount: true },
      orderBy: { createdAt: "asc" },
    });

    const settlement = calculateSettlement(unsettledBets, result, { feeRate: SETTLEMENT_FEE_RATE });

    if (settlement.summary.invalidAmountCount > 0) {
      throw new Error("INVALID_BET_AMOUNT_DETECTED");
    }

    if (settlement.summary.duplicateBetIdCount > 0) {
      throw new Error("DUPLICATE_BET_ID_DETECTED");
    }

    const payoutDelta = settlement.summary.netPool - settlement.summary.payoutTotal;
    if (unsettledBets.length > 0 && payoutDelta !== 0) {
      throw new Error("PAYOUT_INTEGRITY_VIOLATION");
    }

    let settledPayoutTotal = 0;

    for (const bet of settlement.bets) {
      const existingSettlementTx = await tx.walletTransaction.findFirst({
        where: {
          relatedBetId: bet.id,
          type: "BET_SETTLE",
        },
        select: { id: true },
      });

      if (existingSettlementTx) {
        throw new Error("DUPLICATE_SETTLEMENT_TX_DETECTED");
      }

      const settlementUpdate = await tx.bet.updateMany({
        where: {
          id: bet.id,
          settled: false,
        },
        data: {
          settled: true,
          payoutAmount: bet.payout,
        },
      });

      if (settlementUpdate.count !== 1) {
        throw new Error("BET_ALREADY_SETTLED_RACE");
      }

      settledPayoutTotal += bet.payout;

      if (bet.payout > 0) {
        await applyWalletDelta({
          tx,
          userId: bet.userId,
          amount: bet.payout,
          type: "BET_SETTLE",
          relatedBetId: bet.id,
          note: `Settlement payout for topic:${topicId}`,
        });
      }
    }

    if (settledPayoutTotal !== settlement.summary.payoutTotal) {
      throw new Error("SETTLEMENT_PAYOUT_SUM_MISMATCH");
    }

    const settlementLedger = await tx.settlement.create({
      data: {
        topicId,
        result,
        totalPool: settlement.summary.totalPool,
        feeRate: settlement.summary.feeRate,
        feeCollected: settlement.summary.feeAmount,
        netPool: settlement.summary.netPool,
        payoutTotal: settlement.summary.payoutTotal,
        winnerCount: settlement.summary.winnerCount,
        settledById,
      },
    });

    const updatedTopic = await tx.topic.update({
      where: { id: topicId },
      data: { status: TopicStatus.RESOLVED },
    });

    return {
      topic: updatedTopic,
      settlementLedger,
      settlement: settlement.summary,
    };
  });
}

export function enqueueSettlementJob(input: SettlementJobInput) {
  ensureJobInput(input);

  if (inFlightTopics.has(input.topicId)) {
    return { queued: false as const, reason: "ALREADY_QUEUED" as const };
  }

  inFlightTopics.add(input.topicId);

  setTimeout(async () => {
    try {
      await processSettlementWithRetry(input);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return;
      }

      const message = error instanceof Error ? error.message : "UNKNOWN";
      console.error(`[settlement-job] failed topic=${input.topicId} settledBy=${input.settledById} error=${message}`);
    } finally {
      inFlightTopics.delete(input.topicId);
    }
  }, 0);

  return { queued: true as const };
}

export async function processPendingSettlements(limit = 20) {
  const topics = await db.topic.findMany({
    where: {
      status: TopicStatus.LOCKED,
      resolution: { isNot: null },
      settlement: null,
    },
    select: {
      id: true,
      resolution: { select: { resolverId: true } },
    },
    take: Math.max(1, Math.min(100, limit)),
    orderBy: { updatedAt: "asc" },
  });

  const results: Array<{ topicId: string; ok: boolean; error?: string }> = [];

  for (const topic of topics) {
    const resolverId = topic.resolution?.resolverId;
    if (!resolverId) {
      results.push({ topicId: topic.id, ok: false, error: "RESOLVER_ID_MISSING" });
      continue;
    }

    try {
      await processSettlementWithRetry({ topicId: topic.id, settledById: resolverId });
      results.push({ topicId: topic.id, ok: true });
    } catch (error: unknown) {
      results.push({ topicId: topic.id, ok: false, error: error instanceof Error ? error.message : "UNKNOWN" });
    }
  }

  return {
    total: topics.length,
    success: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
    results,
  };
}
