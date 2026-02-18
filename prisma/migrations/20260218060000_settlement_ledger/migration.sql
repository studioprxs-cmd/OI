-- Settlement ledger table for robust, auditable topic settlement
CREATE TABLE IF NOT EXISTS "Settlement" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "result" "Choice" NOT NULL,
  "totalPool" INTEGER NOT NULL,
  "feeRate" DOUBLE PRECISION NOT NULL,
  "feeCollected" INTEGER NOT NULL,
  "netPool" INTEGER NOT NULL,
  "payoutTotal" INTEGER NOT NULL,
  "winnerCount" INTEGER NOT NULL,
  "settledById" TEXT,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Settlement_topicId_key" ON "Settlement"("topicId");
CREATE INDEX IF NOT EXISTS "Settlement_settledAt_idx" ON "Settlement"("settledAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Settlement_topicId_fkey'
      AND table_name = 'Settlement'
  ) THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_topicId_fkey"
      FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Settlement_settledById_fkey'
      AND table_name = 'Settlement'
  ) THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_settledById_fkey"
      FOREIGN KEY ("settledById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
