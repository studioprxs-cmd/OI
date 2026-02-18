ALTER TABLE "Bet"
ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "Bet"
ADD CONSTRAINT "Bet_priceCents_range_check"
CHECK ("priceCents" >= 0 AND "priceCents" <= 100);
