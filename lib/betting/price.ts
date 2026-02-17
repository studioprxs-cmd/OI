export function calcPrices(yesPool: number, noPool: number) {
  const safeYesPool = Number.isFinite(yesPool) ? Math.max(0, yesPool) : 0;
  const safeNoPool = Number.isFinite(noPool) ? Math.max(0, noPool) : 0;
  const total = safeYesPool + safeNoPool;

  if (total <= 0) {
    return { yesCents: 50, noCents: 50 };
  }

  return {
    yesCents: Math.round((safeYesPool / total) * 100),
    noCents: Math.round((safeNoPool / total) * 100),
  };
}

export function calcEstimatedPayout(
  amount: number,
  position: "YES" | "NO",
  yesPool: number,
  noPool: number,
  feeRate = 0.05,
) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (safeAmount <= 0) return 0;

  const safeYesPool = Number.isFinite(yesPool) ? Math.max(0, yesPool) : 0;
  const safeNoPool = Number.isFinite(noPool) ? Math.max(0, noPool) : 0;
  const clampedFeeRate = Number.isFinite(feeRate) ? Math.min(Math.max(feeRate, 0), 1) : 0.05;

  const positionPool = position === "YES" ? safeYesPool : safeNoPool;
  const totalPool = safeYesPool + safeNoPool + safeAmount;
  const netPool = totalPool * (1 - clampedFeeRate);
  const denominator = positionPool + safeAmount;

  if (denominator <= 0) return 0;

  const share = safeAmount / denominator;
  return Math.floor(netPool * share);
}
