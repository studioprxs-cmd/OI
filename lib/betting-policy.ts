export const BET_LIMITS = {
  MIN_AMOUNT: 100,
  MAX_AMOUNT: 50_000,
  MAX_POOL_SHARE: 0.2,
  DAILY_LIMIT: 100_000,
  COOLDOWN_AFTER_LOSSES: 5,
  COOLDOWN_DURATION_MS: 3_600_000,
} as const;

export function getBetLimitError(amount: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "amount must be a positive integer";
  if (amount < BET_LIMITS.MIN_AMOUNT) return `최소 베팅 금액은 ${BET_LIMITS.MIN_AMOUNT}pt 입니다.`;
  if (amount > BET_LIMITS.MAX_AMOUNT) return `최대 베팅 금액은 ${BET_LIMITS.MAX_AMOUNT}pt 입니다.`;
  return null;
}
