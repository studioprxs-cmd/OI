import { Choice } from "@prisma/client";

type BetInput = {
  id: string;
  userId: string;
  choice: Choice;
  amount: number;
};

type SanitizedBet = BetInput & {
  amount: number;
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
  payoutTotal: number;
  invalidAmountCount: number;
};

export function calculateSettlement(bets: BetInput[], result: Choice): {
  bets: SettlementBetResult[];
  summary: SettlementSummary;
} {
  const sanitizedBets: SanitizedBet[] = bets.map((bet) => ({
    ...bet,
    amount: normalizeBetAmount(bet.amount),
  }));

  const invalidAmountCount = bets.reduce((count, bet, index) => {
    return count + (sanitizedBets[index].amount !== bet.amount ? 1 : 0);
  }, 0);

  const totalPool = sanitizedBets.reduce((sum, bet) => sum + bet.amount, 0);
  const winners = sanitizedBets.filter((bet) => bet.choice === result);
  const winnerPool = winners.reduce((sum, bet) => sum + bet.amount, 0);

  if (winnerPool <= 0 || totalPool <= 0) {
    const empty = sanitizedBets.map((bet) => ({ id: bet.id, userId: bet.userId, won: false, payout: 0 }));
    return {
      bets: empty,
      summary: {
        totalPool,
        winnerPool,
        settledCount: sanitizedBets.length,
        winnerCount: 0,
        payoutTotal: 0,
        invalidAmountCount,
      },
    };
  }

  const basePayoutById = new Map<string, number>();
  const fractionalRemainders: Array<{ id: string; remainder: number }> = [];

  let allocated = 0;
  for (const winner of winners) {
    const raw = (totalPool * winner.amount) / winnerPool;
    const floored = Math.floor(raw);
    basePayoutById.set(winner.id, floored);
    fractionalRemainders.push({ id: winner.id, remainder: raw - floored });
    allocated += floored;
  }

  let leftover = Math.max(0, totalPool - allocated);

  fractionalRemainders.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.id.localeCompare(b.id);
  });

  let pointer = 0;
  while (leftover > 0 && fractionalRemainders.length > 0) {
    const winnerId = fractionalRemainders[pointer]?.id;
    if (!winnerId) break;
    basePayoutById.set(winnerId, (basePayoutById.get(winnerId) ?? 0) + 1);
    leftover -= 1;
    pointer = (pointer + 1) % fractionalRemainders.length;
  }

  const settled = sanitizedBets.map((bet) => {
    const payout = basePayoutById.get(bet.id) ?? 0;
    return {
      id: bet.id,
      userId: bet.userId,
      won: payout > 0,
      payout,
    };
  });

  const winnerCount = settled.filter((bet) => bet.payout > 0).length;
  const payoutTotal = settled.reduce((sum, bet) => sum + bet.payout, 0);

  return {
    bets: settled,
    summary: {
      totalPool,
      winnerPool,
      settledCount: settled.length,
      winnerCount,
      payoutTotal,
      invalidAmountCount,
    },
  };
}
