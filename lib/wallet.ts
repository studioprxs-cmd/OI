import { Prisma } from "@prisma/client";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const ALLOWED_WALLET_TX_TYPES = new Set([
  "SIGNUP_BONUS",
  "DAILY_CHECKIN",
  "VOTE_REWARD",
  "COMMENT_REWARD",
  "COMMENT_LIKE_REWARD",
  "BET_PLACE",
  "BET_SETTLE",
  "BET_REFUND",
  "MARKET_PURCHASE",
  "ADMIN_ADJUST",
]);

const WALLET_TX_REFERENCE_RULES: Record<string, { requires?: "bet" | "vote"; allows?: Array<"bet" | "vote"> }> = {
  VOTE_REWARD: { requires: "vote", allows: ["vote"] },
  BET_PLACE: { requires: "bet", allows: ["bet"] },
  BET_SETTLE: { requires: "bet", allows: ["bet"] },
  BET_REFUND: { requires: "bet", allows: ["bet"] },
  SIGNUP_BONUS: { allows: [] },
  DAILY_CHECKIN: { allows: [] },
  COMMENT_REWARD: { allows: [] },
  COMMENT_LIKE_REWARD: { allows: [] },
  MARKET_PURCHASE: { allows: [] },
  ADMIN_ADJUST: { allows: ["bet", "vote"] },
};

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

  const normalizedType = input.type?.trim();
  if (!normalizedType) {
    throw new Error("WALLET_TX_TYPE_REQUIRED");
  }

  if (!ALLOWED_WALLET_TX_TYPES.has(normalizedType)) {
    throw new Error("WALLET_TX_TYPE_INVALID");
  }

  if (input.relatedBetId && input.relatedVoteId) {
    throw new Error("WALLET_RELATED_REFERENCE_CONFLICT");
  }

  const referenceRule = WALLET_TX_REFERENCE_RULES[normalizedType];
  if (!referenceRule) {
    throw new Error("WALLET_TX_TYPE_RULE_NOT_FOUND");
  }

  const hasBetReference = Boolean(input.relatedBetId);
  const hasVoteReference = Boolean(input.relatedVoteId);
  const allowsBetReference = referenceRule.allows?.includes("bet") ?? false;
  const allowsVoteReference = referenceRule.allows?.includes("vote") ?? false;

  if (hasBetReference && !allowsBetReference) {
    throw new Error("WALLET_BET_REFERENCE_NOT_ALLOWED");
  }

  if (hasVoteReference && !allowsVoteReference) {
    throw new Error("WALLET_VOTE_REFERENCE_NOT_ALLOWED");
  }

  if (referenceRule.requires === "bet" && !hasBetReference) {
    throw new Error("WALLET_BET_REFERENCE_REQUIRED");
  }

  if (referenceRule.requires === "vote" && !hasVoteReference) {
    throw new Error("WALLET_VOTE_REFERENCE_REQUIRED");
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
  const normalizedType = type.trim();

  // 지갑 원장 무결성을 위해 사용자 단위 직렬화 잠금을 건다.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet-user:${userId}`}))`;

  const currentUser = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, pointBalance: true },
  });

  if (!currentUser) {
    throw new Error("WALLET_USER_NOT_FOUND");
  }

  const nextBalance = currentUser.pointBalance + normalizedAmount;

  if (nextBalance < 0) {
    throw new Error("WALLET_INSUFFICIENT_BALANCE");
  }

  const writeGuard = await tx.user.updateMany({
    where: {
      id: userId,
      pointBalance: currentUser.pointBalance,
    },
    data: {
      pointBalance: nextBalance,
    },
  });

  if (writeGuard.count !== 1) {
    throw new Error("WALLET_BALANCE_WRITE_RACE");
  }

  const transaction = await tx.walletTransaction.create({
    data: {
      userId,
      type: normalizedType,
      amount: normalizedAmount,
      balanceAfter: nextBalance,
      relatedBetId,
      relatedVoteId,
      note,
    },
  }).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) {
      throw new Error("WALLET_TX_DUPLICATE_REFERENCE");
    }
    throw error;
  });

  return { balanceAfter: nextBalance, transaction };
}
