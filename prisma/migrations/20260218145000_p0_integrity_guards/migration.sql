-- P0 integrity hardening: balance, bet, and settlement invariants

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_pointBalance_non_negative'
      AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_pointBalance_non_negative"
      CHECK ("pointBalance" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WalletTransaction_balanceAfter_non_negative'
      AND conrelid = '"WalletTransaction"'::regclass
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_balanceAfter_non_negative"
      CHECK ("balanceAfter" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Bet_amount_positive'
      AND conrelid = '"Bet"'::regclass
  ) THEN
    ALTER TABLE "Bet"
      ADD CONSTRAINT "Bet_amount_positive"
      CHECK (amount > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Bet_priceCents_bounds'
      AND conrelid = '"Bet"'::regclass
  ) THEN
    ALTER TABLE "Bet"
      ADD CONSTRAINT "Bet_priceCents_bounds"
      CHECK ("priceCents" >= 0 AND "priceCents" <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Settlement_non_negative_numbers'
      AND conrelid = '"Settlement"'::regclass
  ) THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_non_negative_numbers"
      CHECK (
        "totalPool" >= 0
        AND "feeCollected" >= 0
        AND "netPool" >= 0
        AND "payoutTotal" >= 0
        AND "winnerCount" >= 0
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Settlement_pool_accounting'
      AND conrelid = '"Settlement"'::regclass
  ) THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_pool_accounting"
      CHECK ("totalPool" = ("feeCollected" + "netPool"));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Settlement_feeRate_bounds'
      AND conrelid = '"Settlement"'::regclass
  ) THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_feeRate_bounds"
      CHECK ("feeRate" >= 0 AND "feeRate" <= 1);
  END IF;
END $$;
