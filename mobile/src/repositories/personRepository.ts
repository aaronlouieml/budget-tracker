import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export interface PersonRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentRow {
  id: string;
  person_id: string;
  bank_account_id: string | null;
  amount_cents: number;
  date: string;
  created_at: string;
}

export const personRepository = {
  async listAll(): Promise<PersonRow[]> {
    const db = await getDb();
    return db.getAllAsync<PersonRow>('SELECT * FROM people ORDER BY name ASC');
  },

  async findById(id: string): Promise<PersonRow | null> {
    const db = await getDb();
    return db.getFirstAsync<PersonRow>('SELECT * FROM people WHERE id = ?', id);
  },

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  },

  async insert(name: string): Promise<PersonRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync('INSERT INTO people (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, name, now, now);
    return (await this.findById(id))!;
  },

  async update(id: string, name: string): Promise<PersonRow | null> {
    const db = await getDb();
    await db.runAsync('UPDATE people SET name = ?, updated_at = ? WHERE id = ?', name, nowISO(), id);
    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM people WHERE id = ?', id);
    return result.changes > 0;
  },

  async sharesTotalsByPerson(): Promise<Map<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ person_id: string; total: number }>('SELECT person_id, COALESCE(SUM(amount_cents), 0) AS total FROM expense_shares GROUP BY person_id');
    return new Map(rows.map((r) => [r.person_id, r.total]));
  },

  async paymentTotalsByPerson(): Promise<Map<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ person_id: string; total: number }>('SELECT person_id, COALESCE(SUM(amount_cents), 0) AS total FROM debt_payments GROUP BY person_id');
    return new Map(rows.map((r) => [r.person_id, r.total]));
  },

  async sharesTotalForPerson(personId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expense_shares WHERE person_id = ?', personId);
    return row?.total ?? 0;
  },

  async paymentTotalForPerson(personId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM debt_payments WHERE person_id = ?', personId);
    return row?.total ?? 0;
  },

  async sharesForPersonWithExpense(personId: string): Promise<any[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT es.id, es.expense_id, es.amount_cents, e.merchant, e.category, e.date AS expense_date,
              e.amount_cents AS expense_total_cents, e.payment_method, e.credit_card_id, c.name AS credit_card_name
       FROM expense_shares es
       JOIN expenses e ON e.id = es.expense_id
       LEFT JOIN credit_cards c ON c.id = e.credit_card_id
       WHERE es.person_id = ?
       ORDER BY e.date ASC, es.created_at ASC`,
      personId
    );
  },

  async paymentsForPerson(personId: string): Promise<(DebtPaymentRow & { bank_account_name: string | null })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT dp.*, a.name AS bank_account_name FROM debt_payments dp LEFT JOIN bank_accounts a ON a.id = dp.bank_account_id WHERE dp.person_id = ? ORDER BY dp.date DESC, dp.created_at DESC`,
      personId
    );
  },

  async paymentsForAccount(accountId: string): Promise<(DebtPaymentRow & { person_name: string })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT dp.*, p.name AS person_name FROM debt_payments dp JOIN people p ON p.id = dp.person_id WHERE dp.bank_account_id = ? ORDER BY dp.date DESC, dp.created_at DESC`,
      accountId
    );
  },

  async insertPayment(input: { personId: string; bankAccountId: string; amountCents: number; date: string }): Promise<DebtPaymentRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync('INSERT INTO debt_payments (id, person_id, bank_account_id, amount_cents, date, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, input.personId, input.bankAccountId, input.amountCents, input.date, nowISO());
    return (await db.getFirstAsync<DebtPaymentRow>('SELECT * FROM debt_payments WHERE id = ?', id))!;
  },
};
