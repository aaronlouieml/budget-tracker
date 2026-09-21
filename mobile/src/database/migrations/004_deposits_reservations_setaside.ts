// Adds a real pending/received lifecycle to "Coming In" money (previously
// every row was treated as already-real money the instant it was created -
// see bankAccountService.getActivity's prior behavior), a source label so
// the UI can distinguish salary/refund/gift from a plain manual deposit,
// and category + planned-date columns on reservations so "Set Aside" money
// can be organized and sorted by when it's expected to be used.
export const MIGRATION_004_DEPOSITS_RESERVATIONS_SETASIDE = `
ALTER TABLE incoming_money ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received'));
ALTER TABLE incoming_money ADD COLUMN received_at TEXT;
ALTER TABLE incoming_money ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','salary','refund','gift','other'));
UPDATE incoming_money SET status = 'received', received_at = created_at;

ALTER TABLE reservations ADD COLUMN category TEXT;
ALTER TABLE reservations ADD COLUMN planned_date TEXT;
`;
