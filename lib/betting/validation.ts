import { BET_LIMITS, getBetLimitError } from "@/lib/betting-policy";

export function assertBetAmount(amount: number) {
  const amountError = getBetLimitError(amount);
  if (amountError) {
    throw new Error(`BET_AMOUNT_INVALID:${amountError}`);
  }
}

export function assertDailyLimit(currentUserTodayTotal: number, amount: number) {
  const safeTodayTotal = Number.isFinite(currentUserTodayTotal) ? Math.max(0, Math.floor(currentUserTodayTotal)) : 0;

  if (safeTodayTotal + amount > BET_LIMITS.DAILY_LIMIT) {
    throw new Error("DAILY_LIMIT_EXCEEDED");
  }
}

export function assertPoolShare(
  currentTopicPoolTotal: number,
  currentUserTopicTotal: number,
  amount: number,
) {
  const safeTopicPoolTotal = Number.isFinite(currentTopicPoolTotal) ? Math.max(0, Math.floor(currentTopicPoolTotal)) : 0;
  const safeUserTopicTotal = Number.isFinite(currentUserTopicTotal) ? Math.max(0, Math.floor(currentUserTopicTotal)) : 0;

  const projectedPoolTotal = safeTopicPoolTotal + amount;
  const projectedUserShare = projectedPoolTotal > 0
    ? (safeUserTopicTotal + amount) / projectedPoolTotal
    : 0;

  if (safeTopicPoolTotal > 0 && projectedUserShare > BET_LIMITS.MAX_POOL_SHARE) {
    throw new Error("POOL_SHARE_EXCEEDED");
  }
}

export function assertLossCooldown(
  recentSettledBets: Array<{ payoutAmount: number | null; createdAt: Date }>,
  nowMs = Date.now(),
) {
  const hasLossStreak =
    recentSettledBets.length >= BET_LIMITS.COOLDOWN_AFTER_LOSSES
    && recentSettledBets.every((bet) => (bet.payoutAmount ?? 0) <= 0);

  if (!hasLossStreak) {
    return;
  }

  const lastLossAt = recentSettledBets[0]?.createdAt;
  const elapsedMs = lastLossAt ? nowMs - new Date(lastLossAt).getTime() : Number.POSITIVE_INFINITY;

  if (elapsedMs < BET_LIMITS.COOLDOWN_DURATION_MS) {
    const remainingMs = BET_LIMITS.COOLDOWN_DURATION_MS - elapsedMs;
    throw new Error(`COOLDOWN_ACTIVE:${remainingMs}`);
  }
}
