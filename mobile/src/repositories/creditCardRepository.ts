import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export interface CreditCardRow {
  id: string;
  name: string;
  bank: string;
  due_date: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  credit_card_id: string;
  amount_cents: number;
  date: string;
  created_at: string;
}

export const creditCardRepository = {
  async listAll(): Promise<CreditCardRow[]> {
    const db = await getDb();
    return db.getAllAsync<CreditCardRow>('SELECT * FROM credit_cards');
  },

  async findById(id: string): Promise<CreditCardRow | null> {
    const db = await getDb();
    return db.getFirstAsync<CreditCardRow>('SELECT * FROM credit_cards WHERE id = ?', id);
  },

  async insert(input: { name: string; bank: string; dueDate: number }): Promise<CreditCardRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync(
      'INSERT INTO credit_cards (id, name, bank, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      input.name,
      input.bank,
      input.dueDate,
      now,
      now
    );
    return (await this.findById(id))!;
  },

  async update(id: string, input: { name: string; bank: string; dueDate: number }): Promise<CreditCardRow | null> {
    const db = await getDb();
    await db.runAsync('UPDATE credit_cards SET name = ?, bank = ?, due_date = ?, updated_at = ? WHERE id = ?', input.name, input.bank, input.dueDate, nowISO(), id);
    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM credit_cards WHERE id = ?', id);
    return result.changes > 0;
  },

  // outstanding = sum(expenses charged to card) - sum(payments), per card
  async outstandingTotals(): Promise<Map<string, number>> {
    const db = await getDb();
    const [expenseSums, paymentSums] = await Promise.all([
      db.getAllAsync<{ credit_card_id: string; total: number }>(
        `SELECT credit_card_id, COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE credit_card_id IS NOT NULL GROUP BY credit_card_id`
      ),
      db.getAllAsync<{ credit_card_id: string; total: number }>(
        `SELECT credit_card_id, COALESCE(SUM(amount_cents), 0) AS total FROM payments GROUP BY credit_card_id`
      ),
    ]);
    const totals = new Map<string, number>();
    for (const row of expenseSums) totals.set(row.credit_card_id, row.total);
    for (const row of paymentSums) totals.set(row.credit_card_id, (totals.get(row.credit_card_id) ?? 0) - row.total);
    return totals;
  },

  async outstandingForCard(cardId: string): Promise<number> {
    const db = await getDb();
    const [expenseSum, paymentSum] = await Promise.all([
      db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses WHERE credit_card_id = ?', cardId),
      db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE credit_card_id = ?', cardId),
    ]);
    return (expenseSum?.total ?? 0) - (paymentSum?.total ?? 0);
  },

  async transactionsForCard(cardId: string): Promise<any[]> {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT id, amount_cents, category, date, merchant, payment_method, credit_card_id, bank_account_id, created_at, updated_at FROM expenses WHERE credit_card_id = ? ORDER BY date DESC, created_at DESC',
      cardId
    );
  },

  async paymentsForCard(cardId: string): Promise<PaymentRow[]> {
    const db = await getDb();
    return db.getAllAsync<PaymentRow>('SELECT * FROM payments WHERE credit_card_id = ? ORDER BY date DESC, created_at DESC', cardId);
  },

  async insertPayment(input: { creditCardId: string; amountCents: number; date: string }): Promise<PaymentRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync('INSERT INTO payments (id, credit_card_id, amount_cents, date, created_at) VALUES (?, ?, ?, ?, ?)', id, input.creditCardId, input.amountCents, input.date, nowISO());
    return (await db.getFirstAsync<PaymentRow>('SELECT * FROM payments WHERE id = ?', id))!;
  },
};
