import { Choice } from "@prisma/client";

type BetInput = {
  id: string;
  userId: string;
  choice: Choice;
  amount: number;
};

type SanitizedBet = BetInput & {
  amount: number;
  settlementKey: string;
};

function normalizeBetAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (amount <= 0) return 0;
  return Math.floor(amount);
}

export type SettlementBetResult = {
  id: string;
  userId: string;
  won: boolean;
  payout: number;
};

export type SettlementSummary = {
  totalPool: number;
  winnerPool: number;
  settledCount: number;
  winnerCount: number;
  feeRate: number;
  feeAmount: number;
  netPool: number;
  payoutTotal: number;
  invalidAmountCount: number;
  duplicateBetIdCount: number;
};

export function calculateSettlement(
  bets: BetInput[],
  result: Choice,
  options?: { feeRate?: number },
): {
  bets: SettlementBetResult[];
  summary: SettlementSummary;
} {
  const sanitizedBets: SanitizedBet[] = bets.map((bet, index) => ({
    ...bet,
    amount: normalizeBetAmount(bet.amount),
    settlementKey: `${bet.id}::${index}`,
  }));

  const invalidAmountCount = bets.reduce((count, bet, index) => {
    return count + (sanitizedBets[index].amount !== bet.amount ? 1 : 0);
  }, 0);

  const duplicateBetIdCount = (() => {
    const seenIds = new Set<string>();
    let duplicates = 0;

    for (const bet of bets) {
      if (seenIds.has(bet.id)) {
        duplicates += 1;
      } else {
        seenIds.add(bet.id);
      }
    }

    return duplicates;
  })();

  const totalPool = sanitizedBets.reduce((sum, bet) => sum + bet.amount, 0);
  const winners = sanitizedBets.filter((bet) => bet.choice === result);
  const winnerPool = winners.reduce((sum, bet) => sum + bet.amount, 0);
  const feeRate = Math.max(0, Math.min(1, options?.feeRate ?? 0));
  const feeAmount = Math.floor(totalPool * feeRate);
  const netPool = Math.max(0, totalPool - feeAmount);

  if (winnerPool <= 0 || totalPool <= 0) {
    const empty = sanitizedBets.map((bet) => ({ id: bet.id, userId: bet.userId, won: false, payout: 0 }));
    return {
      bets: empty,
      summary: {
        totalPool,
        winnerPool,
        settledCount: sanitizedBets.length,
        winnerCount: 0,
        feeRate,
        feeAmount,
        netPool,
        payoutTotal: 0,
        invalidAmountCount,
        duplicateBetIdCount,
      },
    };
  }

  const basePayoutBySettlementKey = new Map<string, number>();
  const fractionalRemainders: Array<{ settlementKey: string; remainder: number }> = [];

  let allocated = 0;
  for (const winner of winners) {
    const raw = (netPool * winner.amount) / winnerPool;
    const floored = Math.floor(raw);
    basePayoutBySettlementKey.set(winner.settlementKey, floored);
    fractionalRemainders.push({ settlementKey: winner.settlementKey, remainder: raw - floored });
    allocated += floored;
  }

  let leftover = Math.max(0, netPool - allocated);

  fractionalRemainders.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.settlementKey.localeCompare(b.settlementKey);
  });

  let pointer = 0;
  while (leftover > 0 && fractionalRemainders.length > 0) {
    const winnerSettlementKey = fractionalRemainders[pointer]?.settlementKey;
    if (!winnerSettlementKey) break;
    basePayoutBySettlementKey.set(winnerSettlementKey, (basePayoutBySettlementKey.get(winnerSettlementKey) ?? 0) + 1);
    leftover -= 1;
    pointer = (pointer + 1) % fractionalRemainders.length;
  }

  const settled = sanitizedBets.map((bet) => {
    const payout = basePayoutBySettlementKey.get(bet.settlementKey) ?? 0;
    return {
      id: bet.id,
      userId: bet.userId,
      won: payout > 0,
      payout,
    };
  });

  const winnerCount = winners.length;
  const payoutTotal = settled.reduce((sum, bet) => sum + bet.payout, 0);

  return {
    bets: settled,
    summary: {
      totalPool,
      winnerPool,
      settledCount: settled.length,
      winnerCount,
      feeRate,
      feeAmount,
      netPool,
      payoutTotal,
      invalidAmountCount,
      duplicateBetIdCount,
    },
  };
}
