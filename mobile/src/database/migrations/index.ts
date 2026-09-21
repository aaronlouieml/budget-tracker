import { MIGRATION_001_INITIAL } from './001_initial';
import { MIGRATION_002_TRANSFERS_AND_PAYMENT_ACCOUNTS } from './002_transfers_and_payment_accounts';
import { MIGRATION_003_PLANS_RECURRING_SETTINGS } from './003_plans_recurring_settings';
import { MIGRATION_004_DEPOSITS_RESERVATIONS_SETASIDE } from './004_deposits_reservations_setaside';
import { MIGRATION_005_RECEIPT_SCAN_SOURCE } from './005_receipt_scan_source';
import { MIGRATION_006_RESERVATION_USED_AND_EXPENSE_RESERVATION } from './006_reservation_used_and_expense_reservation';

// One entry per schema version. `PRAGMA user_version` tracks which of these
// have already run - see sqlite.ts. Append new entries here for future
// schema changes; never edit an already-shipped entry.
export const MIGRATIONS: string[] = [
  MIGRATION_001_INITIAL,
  MIGRATION_002_TRANSFERS_AND_PAYMENT_ACCOUNTS,
  MIGRATION_003_PLANS_RECURRING_SETTINGS,
  MIGRATION_004_DEPOSITS_RESERVATIONS_SETASIDE,
  MIGRATION_005_RECEIPT_SCAN_SOURCE,
  MIGRATION_006_RESERVATION_USED_AND_EXPENSE_RESERVATION,
];
