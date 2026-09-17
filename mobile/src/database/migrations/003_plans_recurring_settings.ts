// Adds: saved/planned reserved-money allocations, recurring credit card
// payment definitions, a simple key-value settings store (home section
// visibility + preferences), and opening-balance columns so onboarding can
// record pre-existing credit card debt / money owed without fabricating
// expense or shared-expense rows for history that happened before the app
// was used.
export const MIGRATION_003_PLANS_RECURRING_SETTINGS = `
ALTER TABLE credit_cards ADD COLUMN opening_balance_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE people ADD COLUMN opening_owed_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE saved_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  expected_date TEXT,
  planned_amount_cents INTEGER,
  note TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE saved_plan_allocations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES saved_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_plan_allocations_plan ON saved_plan_allocations(plan_id);

-- One row per time a plan is actually imported (a plan can be reused), so
-- account activity history can show the real deposit event distinctly from
-- the reservations it created.
CREATE TABLE plan_imports (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES saved_plans(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_plan_imports_account ON plan_imports(bank_account_id);

CREATE TABLE recurring_payments (
  id TEXT PRIMARY KEY,
  credit_card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','yearly')),
  next_date TEXT NOT NULL,
  category TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_recurring_payments_card ON recurring_payments(credit_card_id);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
