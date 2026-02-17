import { Prisma } from "@prisma/client";

type ApplyWalletDeltaInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  amount: number;
  type: string;
  relatedBetId?: string;
  relatedVoteId?: string;
  note?: string;
};

function ensureWalletInputIntegrity(input: ApplyWalletDeltaInput) {
  if (!input.userId) {
    throw new Error("WALLET_USER_ID_REQUIRED");
  }

  if (!input.type?.trim()) {
    throw new Error("WALLET_TX_TYPE_REQUIRED");
  }

  if (input.relatedBetId && input.relatedVoteId) {
    throw new Error("WALLET_RELATED_REFERENCE_CONFLICT");
  }

  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount)) {
    throw new Error("WALLET_AMOUNT_MUST_BE_INTEGER");
  }

  if (input.amount === 0) {
    throw new Error("WALLET_ZERO_DELTA");
  }
}

export async function applyWalletDelta(input: ApplyWalletDeltaInput) {
  ensureWalletInputIntegrity(input);

  const { tx, userId, amount, type, relatedBetId, relatedVoteId, note } = input;
  const normalizedAmount = amount;

  // 지갑 원장 무결성을 위해 사용자 단위 직렬화 잠금을 건다.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet-user:${userId}`}))`;

  if (normalizedAmount > 0) {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { pointBalance: { increment: normalizedAmount } },
      select: { pointBalance: true },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type,
        amount: normalizedAmount,
        balanceAfter: updatedUser.pointBalance,
        relatedBetId,
        relatedVoteId,
        note,
      },
    });

    return { balanceAfter: updatedUser.pointBalance, transaction };
  }

  const spendAmount = Math.abs(normalizedAmount);
  const spendGuard = await tx.user.updateMany({
    where: {
      id: userId,
      pointBalance: { gte: spendAmount },
    },
    data: { pointBalance: { decrement: spendAmount } },
  });

  if (spendGuard.count !== 1) {
    throw new Error("WALLET_INSUFFICIENT_BALANCE");
  }

  const updatedUser = await tx.user.findUnique({
    where: { id: userId },
    select: { pointBalance: true },
  });

  if (!updatedUser) {
    throw new Error("WALLET_USER_NOT_FOUND");
  }

  const transaction = await tx.walletTransaction.create({
    data: {
      userId,
      type,
      amount: normalizedAmount,
      balanceAfter: updatedUser.pointBalance,
      relatedBetId,
      relatedVoteId,
      note,
    },
  });

  return { balanceAfter: updatedUser.pointBalance, transaction };
}
