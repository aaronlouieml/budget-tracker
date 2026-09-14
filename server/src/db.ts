import { Pool, types } from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of Date objects,
// which pg otherwise constructs in local time and skews when serialized to UTC.
types.setTypeParser(types.builtins.DATE, (val) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
