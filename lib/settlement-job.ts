import { Choice, Prisma, TopicStatus } from "@prisma/client";
import { Queue, Worker } from "bullmq";

import { db } from "@/lib/db";
import { calculateSettlement } from "@/lib/settlement";
import { applyWalletDelta } from "@/lib/wallet";

const SETTLEMENT_FEE_RATE = 0.05;
const SETTLEMENT_MAX_RETRIES = 3;
const SETTLEMENT_RETRY_DELAY_MS = 250;

const inFlightTopics = new Set<string>();
const SETTLEMENT_QUEUE_NAME = "oi:settlement";

let settlementQueue: Queue | null = null;
let settlementWorker: Worker | null = null;

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  return {
    url: redisUrl,
  };
}

function getSettlementQueue() {
  const connection = getRedisConnection();
  if (!connection) return null;

  if (!settlementQueue) {
    settlementQueue = new Queue(SETTLEMENT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: SETTLEMENT_MAX_RETRIES,
        backoff: {
          type: "fixed",
          delay: SETTLEMENT_RETRY_DELAY_MS,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }

  return settlementQueue;
}

function ensureSettlementWorker() {
  const connection = getRedisConnection();
  if (!connection || settlementWorker) return settlementWorker;

  settlementWorker = new Worker(
    SETTLEMENT_QUEUE_NAME,
    async (job) => processSettlementWithRetry(job.data as SettlementJobInput),
    {
      connection,
      concurrency: 4,
    },
  );

  settlementWorker.on("failed", (job, error) => {
    const topicId = job?.data?.topicId ?? "unknown";
    const settledById = job?.data?.settledById ?? "unknown";
    const message = error instanceof Error ? error.message : String(error ?? "UNKNOWN");
    console.error(`[settlement-worker] failed topic=${topicId} settledBy=${settledById} error=${message}`);
  });

  return settlementWorker;
}

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
    if (topic.status !== TopicStatus.LOCKED) throw new Error("TOPIC_STATUS_INVALID_FOR_SETTLEMENT");

    const result = topic.resolution.result as Choice;

    const topicBets = await tx.bet.findMany({
      where: { topicId },
      select: {
        id: true,
        userId: true,
        choice: true,
        amount: true,
        settled: true,
        payoutAmount: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const settlement = calculateSettlement(topicBets, result, { feeRate: SETTLEMENT_FEE_RATE });

    if (settlement.summary.invalidAmountCount > 0) {
      throw new Error("INVALID_BET_AMOUNT_DETECTED");
    }

    if (settlement.summary.duplicateBetIdCount > 0) {
      throw new Error("DUPLICATE_BET_ID_DETECTED");
    }

    const payoutDelta = settlement.summary.netPool - settlement.summary.payoutTotal;
    if (topicBets.length > 0 && payoutDelta !== 0) {
      throw new Error("PAYOUT_INTEGRITY_VIOLATION");
    }

    const expectedPayoutByBetId = new Map(settlement.bets.map((bet) => [bet.id, bet]));

    let settledPayoutTotal = 0;

    for (const storedBet of topicBets) {
      const expected = expectedPayoutByBetId.get(storedBet.id);
      if (!expected) {
        throw new Error("SETTLEMENT_BET_EXPECTATION_MISSING");
      }

      const existingSettlementTx = await tx.walletTransaction.findFirst({
        where: {
          relatedBetId: storedBet.id,
          type: "BET_SETTLE",
        },
        select: { id: true },
      });

      if (storedBet.settled) {
        const storedPayout = storedBet.payoutAmount ?? 0;

        if (storedPayout !== expected.payout) {
          throw new Error("PARTIAL_SETTLEMENT_PAYOUT_MISMATCH");
        }

        if (storedPayout > 0 && !existingSettlementTx) {
          throw new Error("PARTIAL_SETTLEMENT_LEDGER_MISSING");
        }

        if (storedPayout <= 0 && existingSettlementTx) {
          throw new Error("PARTIAL_SETTLEMENT_LEDGER_UNEXPECTED");
        }

        settledPayoutTotal += storedPayout;
        continue;
      }

      if (existingSettlementTx) {
        throw new Error("DUPLICATE_SETTLEMENT_TX_DETECTED");
      }

      const settlementUpdate = await tx.bet.updateMany({
        where: {
          id: storedBet.id,
          settled: false,
        },
        data: {
          settled: true,
          payoutAmount: expected.payout,
        },
      });

      if (settlementUpdate.count !== 1) {
        throw new Error("BET_ALREADY_SETTLED_RACE");
      }

      settledPayoutTotal += expected.payout;

      if (expected.payout > 0) {
        await applyWalletDelta({
          tx,
          userId: storedBet.userId,
          amount: expected.payout,
          type: "BET_SETTLE",
          relatedBetId: storedBet.id,
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

export async function enqueueSettlementJob(input: SettlementJobInput) {
  ensureJobInput(input);

  const queue = getSettlementQueue();
  if (queue) {
    ensureSettlementWorker();

    const existing = await queue.getJob(input.topicId);
    if (existing) {
      const state = await existing.getState();

      if (state === "waiting" || state === "active" || state === "delayed") {
        return { queued: false as const, reason: "ALREADY_QUEUED" as const, mode: "bullmq" as const };
      }

      // removeOnComplete/removeOnFail 보존 구간에서는 동일 jobId 재등록이 실패하므로
      // 완료/실패/정지된 잡은 명시적으로 제거 후 재큐잉한다.
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else {
        // unknown state일 때는 중복 enqueue를 피한다.
        return { queued: false as const, reason: "UNEXPECTED_JOB_STATE" as const, mode: "bullmq" as const, state };
      }
    }

    await queue.add("settle-topic", input, {
      jobId: input.topicId,
    });

    return { queued: true as const, mode: "bullmq" as const };
  }

  if (inFlightTopics.has(input.topicId)) {
    return { queued: false as const, reason: "ALREADY_QUEUED" as const, mode: "memory" as const };
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

  return { queued: true as const, mode: "memory" as const };
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
