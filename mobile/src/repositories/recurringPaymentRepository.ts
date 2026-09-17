import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringPaymentRow {
  id: string;
  credit_card_id: string;
  name: string;
  amount_cents: number;
  frequency: RecurringFrequency;
  next_date: string;
  category: string | null;
  is_active: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const recurringPaymentRepository = {
  async forCard(cardId: string): Promise<RecurringPaymentRow[]> {
    const db = await getDb();
    return db.getAllAsync<RecurringPaymentRow>(
      'SELECT * FROM recurring_payments WHERE credit_card_id = ? ORDER BY next_date ASC',
      cardId
    );
  },

  async listActive(): Promise<(RecurringPaymentRow & { credit_card_name: string })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT rp.*, c.name AS credit_card_name FROM recurring_payments rp JOIN credit_cards c ON c.id = rp.credit_card_id WHERE rp.is_active = 1 ORDER BY rp.next_date ASC`
    );
  },

  async findById(id: string): Promise<RecurringPaymentRow | null> {
    const db = await getDb();
    return db.getFirstAsync<RecurringPaymentRow>('SELECT * FROM recurring_payments WHERE id = ?', id);
  },

  async insert(input: {
    creditCardId: string;
    name: string;
    amountCents: number;
    frequency: RecurringFrequency;
    nextDate: string;
    category: string | null;
    note: string | null;
  }): Promise<RecurringPaymentRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync(
      `INSERT INTO recurring_payments (id, credit_card_id, name, amount_cents, frequency, next_date, category, is_active, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      id,
      input.creditCardId,
      input.name,
      input.amountCents,
      input.frequency,
      input.nextDate,
      input.category,
      input.note,
      now,
      now
    );
    return (await this.findById(id))!;
  },

  async update(
    id: string,
    input: { name: string; amountCents: number; frequency: RecurringFrequency; nextDate: string; category: string | null; note: string | null }
  ): Promise<RecurringPaymentRow | null> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE recurring_payments SET name = ?, amount_cents = ?, frequency = ?, next_date = ?, category = ?, note = ?, updated_at = ? WHERE id = ?`,
      input.name,
      input.amountCents,
      input.frequency,
      input.nextDate,
      input.category,
      input.note,
      nowISO(),
      id
    );
    return this.findById(id);
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE recurring_payments SET is_active = ?, updated_at = ? WHERE id = ?', isActive ? 1 : 0, nowISO(), id);
  },

  async setNextDate(id: string, nextDate: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE recurring_payments SET next_date = ?, updated_at = ? WHERE id = ?', nextDate, nowISO(), id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM recurring_payments WHERE id = ?', id);
    return result.changes > 0;
  },
};
