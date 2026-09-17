import { MIGRATION_001_INITIAL } from './001_initial';
import { MIGRATION_002_TRANSFERS_AND_PAYMENT_ACCOUNTS } from './002_transfers_and_payment_accounts';
import { MIGRATION_003_PLANS_RECURRING_SETTINGS } from './003_plans_recurring_settings';

// One entry per schema version. `PRAGMA user_version` tracks which of these
// have already run - see sqlite.ts. Append new entries here for future
// schema changes; never edit an already-shipped entry.
export const MIGRATIONS: string[] = [
  MIGRATION_001_INITIAL,
  MIGRATION_002_TRANSFERS_AND_PAYMENT_ACCOUNTS,
  MIGRATION_003_PLANS_RECURRING_SETTINGS,
];
