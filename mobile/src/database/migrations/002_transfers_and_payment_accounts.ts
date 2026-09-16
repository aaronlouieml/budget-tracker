// Adds account-to-account transfers, and records which bank account (if any)
// paid a credit card payment, so account activity history can show it.
export const MIGRATION_002_TRANSFERS_AND_PAYMENT_ACCOUNTS = `
ALTER TABLE payments ADD COLUMN bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_payments_bank_account ON payments(bank_account_id);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  from_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_transfers_from_account ON transfers(from_account_id);
CREATE INDEX idx_transfers_to_account ON transfers(to_account_id);
`;
