-- Wallet ledger integrity hardening for settlement/vote rewards
ALTER TABLE "WalletTransaction"
  ADD COLUMN IF NOT EXISTS "relatedVoteId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_tx_related_bet_type_key"
  ON "WalletTransaction"("relatedBetId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_tx_related_vote_type_key"
  ON "WalletTransaction"("relatedVoteId", "type");
