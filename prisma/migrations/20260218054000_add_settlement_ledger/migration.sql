-- Create settlement ledger table for payout/fee integrity auditing
CREATE TABLE "Settlement" (
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

CREATE UNIQUE INDEX "Settlement_topicId_key" ON "Settlement"("topicId");
CREATE INDEX "Settlement_settledAt_idx" ON "Settlement"("settledAt");

ALTER TABLE "Settlement"
ADD CONSTRAINT "Settlement_topicId_fkey"
FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
