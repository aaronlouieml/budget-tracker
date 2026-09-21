// Reservations: record when/how a set-aside was used, so a manually released
// one can show up in Recent Activity (with its amount preserved) instead of
// lingering in the Set Aside list. 'release' = the user marked it used;
// 'payment' = it was consumed by a real payment/expense, which already has
// its own activity row (so it must not be listed twice). Legacy fulfilled
// rows already had their amount zeroed, so they're tagged 'payment' to keep
// them out of activity.
//
// Expenses: remember which set-aside an expense was paid from (and how much
// it consumed) so editing/deleting that expense can restore the set-aside.
export const MIGRATION_006_RESERVATION_USED_AND_EXPENSE_RESERVATION = `
ALTER TABLE reservations ADD COLUMN fulfilled_at TEXT;
ALTER TABLE reservations ADD COLUMN fulfilled_via TEXT CHECK (fulfilled_via IN ('release','payment'));
UPDATE reservations SET fulfilled_at = created_at, fulfilled_via = 'payment' WHERE status = 'fulfilled';

ALTER TABLE expenses ADD COLUMN reservation_id TEXT;
ALTER TABLE expenses ADD COLUMN reservation_used_cents INTEGER;
`;
