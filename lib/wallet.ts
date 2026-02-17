import { Prisma } from "@prisma/client";

type ApplyWalletDeltaInput = {
  tx: Prisma.TransactionClient;
  userId: string;
  amount: number;
  type: string;
  relatedBetId?: string;
  note?: string;
};

export async function applyWalletDelta(input: ApplyWalletDeltaInput) {
  const { tx, userId, amount, type, relatedBetId, note } = input;
  const normalizedAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0;

  if (normalizedAmount === 0) {
    throw new Error("WALLET_ZERO_DELTA");
  }

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
      note,
    },
  });

  return { balanceAfter: updatedUser.pointBalance, transaction };
}
