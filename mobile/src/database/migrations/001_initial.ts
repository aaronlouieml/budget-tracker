// Mirrors the old PostgreSQL schema, minus `users`/`user_id` (single local
// user) and with TEXT UUID primary keys instead of autoincrement integers
// (autoincrement IDs collide across devices the moment sync exists).
// Money is stored as integer cents - see utils/money.ts.
export const MIGRATION_001_INITIAL = `
CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('savings','checking','cash','ewallet')),
  balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE credit_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  due_date INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  merchant TEXT,
  payment_method TEXT,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  receipt_image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_credit_card ON expenses(credit_card_id);
CREATE INDEX idx_expenses_bank_account ON expenses(bank_account_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  credit_card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_payments_credit_card ON payments(credit_card_id);

CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('credit_card_payment','bill','other')),
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','fulfilled')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_reservations_account ON reservations(bank_account_id);
CREATE INDEX idx_reservations_card ON reservations(credit_card_id);

CREATE TABLE incoming_money (
  id TEXT PRIMARY KEY,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_incoming_account ON incoming_money(bank_account_id);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE expense_shares (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_shares_expense ON expense_shares(expense_id);
CREATE INDEX idx_shares_person ON expense_shares(person_id);

CREATE TABLE debt_payments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_debt_payments_person ON debt_payments(person_id);
`;
