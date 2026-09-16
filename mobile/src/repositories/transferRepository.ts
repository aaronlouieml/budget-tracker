import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export interface TransferRow {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_cents: number;
  note: string | null;
  date: string;
  created_at: string;
}

export const transferRepository = {
  async insert(input: { fromAccountId: string; toAccountId: string; amountCents: number; note: string | null; date: string }): Promise<TransferRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync(
      'INSERT INTO transfers (id, from_account_id, to_account_id, amount_cents, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      input.fromAccountId,
      input.toAccountId,
      input.amountCents,
      input.note,
      input.date,
      nowISO()
    );
    return (await db.getFirstAsync<TransferRow>('SELECT * FROM transfers WHERE id = ?', id))!;
  },

  async forAccount(accountId: string): Promise<(TransferRow & { from_account_name: string; to_account_name: string })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT t.*, fa.name AS from_account_name, ta.name AS to_account_name
       FROM transfers t
       JOIN bank_accounts fa ON fa.id = t.from_account_id
       JOIN bank_accounts ta ON ta.id = t.to_account_id
       WHERE t.from_account_id = ? OR t.to_account_id = ?
       ORDER BY t.date DESC, t.created_at DESC`,
      accountId,
      accountId
    );
  },
};
