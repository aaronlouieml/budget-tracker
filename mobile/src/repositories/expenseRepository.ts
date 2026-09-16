import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export interface ExpenseRow {
  id: string;
  amount_cents: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: string | null;
  bank_account_id: string | null;
  receipt_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseShareRow {
  id: string;
  expense_id: string;
  person_id: string;
  amount_cents: number;
  created_at: string;
}

const LIST_COLUMNS = 'id, amount_cents, category, date, merchant, payment_method, credit_card_id, bank_account_id, created_at, updated_at';

export const expenseRepository = {
  async listAll(): Promise<ExpenseRow[]> {
    const db = await getDb();
    return db.getAllAsync<ExpenseRow>(`SELECT ${LIST_COLUMNS} FROM expenses ORDER BY date DESC, created_at DESC`);
  },

  async forAccount(accountId: string): Promise<ExpenseRow[]> {
    const db = await getDb();
    return db.getAllAsync<ExpenseRow>(`SELECT ${LIST_COLUMNS} FROM expenses WHERE bank_account_id = ? ORDER BY date DESC, created_at DESC`, accountId);
  },

  async findById(id: string): Promise<ExpenseRow | null> {
    const db = await getDb();
    return db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', id);
  },

  async insert(input: {
    amountCents: number;
    category: string;
    date: string;
    merchant: string | null;
    paymentMethod: string | null;
    creditCardId: string | null;
    bankAccountId: string | null;
    receiptImage: string | null;
  }): Promise<ExpenseRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync(
      `INSERT INTO expenses (id, amount_cents, category, date, merchant, payment_method, credit_card_id, bank_account_id, receipt_image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.amountCents,
      input.category,
      input.date,
      input.merchant,
      input.paymentMethod,
      input.creditCardId,
      input.bankAccountId,
      input.receiptImage,
      now,
      now
    );
    return (await this.findById(id))!;
  },

  async update(
    id: string,
    input: {
      amountCents: number;
      category: string;
      date: string;
      merchant: string | null;
      paymentMethod: string | null;
      creditCardId: string | null;
      bankAccountId: string | null;
      receiptImage: string | null;
    }
  ): Promise<ExpenseRow | null> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE expenses SET amount_cents = ?, category = ?, date = ?, merchant = ?, payment_method = ?,
        credit_card_id = ?, bank_account_id = ?, receipt_image = COALESCE(?, receipt_image), updated_at = ?
       WHERE id = ?`,
      input.amountCents,
      input.category,
      input.date,
      input.merchant,
      input.paymentMethod,
      input.creditCardId,
      input.bankAccountId,
      input.receiptImage,
      nowISO(),
      id
    );
    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
    return result.changes > 0;
  },

  async sharesForExpense(expenseId: string): Promise<(ExpenseShareRow & { person_name: string })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT es.*, p.name AS person_name FROM expense_shares es JOIN people p ON p.id = es.person_id WHERE es.expense_id = ? ORDER BY es.created_at ASC`,
      expenseId
    );
  },

  async replaceShares(expenseId: string, shares: { personId: string; amountCents: number }[]): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM expense_shares WHERE expense_id = ?', expenseId);
    for (const share of shares) {
      await db.runAsync('INSERT INTO expense_shares (id, expense_id, person_id, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)', newId(), expenseId, share.personId, share.amountCents, nowISO());
    }
  },

  // Monthly/period aggregates for dashboard & reports
  async totalForDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE date BETWEEN ? AND ?', startDate, endDate);
    return row?.total ?? 0;
  },

  async categoryTotalsForDateRange(startDate: string, endDate: string): Promise<{ category: string; total: number }[]> {
    const db = await getDb();
    return db.getAllAsync('SELECT category, SUM(amount_cents) AS total FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC', startDate, endDate);
  },

  async dailyTotalsForDateRange(startDate: string, endDate: string): Promise<{ date: string; total: number }[]> {
    const db = await getDb();
    return db.getAllAsync('SELECT date, SUM(amount_cents) AS total FROM expenses WHERE date BETWEEN ? AND ? GROUP BY date', startDate, endDate);
  },

  async recent(limit: number): Promise<ExpenseRow[]> {
    const db = await getDb();
    return db.getAllAsync<ExpenseRow>(`SELECT ${LIST_COLUMNS} FROM expenses ORDER BY date DESC, created_at DESC LIMIT ?`, limit);
  },
};
