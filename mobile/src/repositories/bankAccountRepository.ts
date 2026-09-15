import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

// Raw row shapes (cents, snake_case) - only bankAccountService should import
// this file. Screens/services never see cents or touch SQL directly.
export interface BankAccountRow {
  id: string;
  name: string;
  type: string;
  balance_cents: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationRow {
  id: string;
  bank_account_id: string;
  name: string;
  amount_cents: number;
  purpose: string;
  credit_card_id: string | null;
  status: string;
  created_at: string;
}

export interface IncomingMoneyRow {
  id: string;
  bank_account_id: string;
  amount_cents: number;
  description: string | null;
  created_at: string;
}

export const bankAccountRepository = {
  async listAll(): Promise<BankAccountRow[]> {
    const db = await getDb();
    return db.getAllAsync<BankAccountRow>('SELECT * FROM bank_accounts ORDER BY created_at ASC');
  },

  async findById(id: string): Promise<BankAccountRow | null> {
    const db = await getDb();
    return db.getFirstAsync<BankAccountRow>('SELECT * FROM bank_accounts WHERE id = ?', id);
  },

  async insert(input: { name: string; type: string; balanceCents: number }): Promise<BankAccountRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync(
      'INSERT INTO bank_accounts (id, name, type, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      input.name,
      input.type,
      input.balanceCents,
      now,
      now
    );
    return (await this.findById(id))!;
  },

  async update(id: string, input: { name: string; type: string; balanceCents: number }): Promise<BankAccountRow | null> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE bank_accounts SET name = ?, type = ?, balance_cents = ?, updated_at = ? WHERE id = ?',
      input.name,
      input.type,
      input.balanceCents,
      nowISO(),
      id
    );
    return this.findById(id);
  },

  async adjustBalance(id: string, deltaCents: number): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE bank_accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE id = ?', deltaCents, nowISO(), id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM bank_accounts WHERE id = ?', id);
    return result.changes > 0;
  },

  async reservedTotalsByAccount(): Promise<Map<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ bank_account_id: string; total: number }>(
      `SELECT bank_account_id, COALESCE(SUM(amount_cents), 0) AS total FROM reservations WHERE status = 'reserved' GROUP BY bank_account_id`
    );
    return new Map(rows.map((r) => [r.bank_account_id, r.total]));
  },

  async reservedTotalForAccount(accountId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM reservations WHERE bank_account_id = ? AND status = 'reserved'`,
      accountId
    );
    return row?.total ?? 0;
  },

  async reservationsForAccount(accountId: string): Promise<(ReservationRow & { credit_card_name: string | null })[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT r.*, c.name AS credit_card_name
       FROM reservations r
       LEFT JOIN credit_cards c ON c.id = r.credit_card_id
       WHERE r.bank_account_id = ?
       ORDER BY r.created_at DESC`,
      accountId
    );
  },

  async findReservation(accountId: string, reservationId: string): Promise<ReservationRow | null> {
    const db = await getDb();
    return db.getFirstAsync<ReservationRow>(
      `SELECT * FROM reservations WHERE id = ? AND bank_account_id = ?`,
      reservationId,
      accountId
    );
  },

  async insertReservation(input: {
    bankAccountId: string;
    name: string;
    amountCents: number;
    purpose: string;
    creditCardId: string | null;
  }): Promise<ReservationRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync(
      `INSERT INTO reservations (id, bank_account_id, name, amount_cents, purpose, credit_card_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)`,
      id,
      input.bankAccountId,
      input.name,
      input.amountCents,
      input.purpose,
      input.creditCardId,
      nowISO()
    );
    return (await db.getFirstAsync<ReservationRow>('SELECT * FROM reservations WHERE id = ?', id))!;
  },

  async updateReservation(
    reservationId: string,
    input: { name: string; amountCents: number; purpose: string; creditCardId: string | null }
  ): Promise<ReservationRow | null> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE reservations SET name = ?, amount_cents = ?, purpose = ?, credit_card_id = ? WHERE id = ?`,
      input.name,
      input.amountCents,
      input.purpose,
      input.creditCardId,
      reservationId
    );
    return db.getFirstAsync<ReservationRow>('SELECT * FROM reservations WHERE id = ?', reservationId);
  },

  async setReservationAmount(reservationId: string, amountCents: number, status: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE reservations SET amount_cents = ?, status = ? WHERE id = ?', amountCents, status, reservationId);
  },

  async otherReservedTotal(accountId: string, excludeReservationId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM reservations WHERE bank_account_id = ? AND status = 'reserved' AND id != ?`,
      accountId,
      excludeReservationId
    );
    return row?.total ?? 0;
  },

  async deleteReservation(accountId: string, reservationId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM reservations WHERE id = ? AND bank_account_id = ?', reservationId, accountId);
    return result.changes > 0;
  },

  async activeReservationsForPayment(accountId: string, creditCardId: string): Promise<ReservationRow[]> {
    const db = await getDb();
    return db.getAllAsync<ReservationRow>(
      `SELECT * FROM reservations WHERE bank_account_id = ? AND credit_card_id = ? AND status = 'reserved' ORDER BY created_at ASC`,
      accountId,
      creditCardId
    );
  },

  async incomingForAccount(accountId: string): Promise<IncomingMoneyRow[]> {
    const db = await getDb();
    return db.getAllAsync<IncomingMoneyRow>('SELECT * FROM incoming_money WHERE bank_account_id = ? ORDER BY created_at DESC', accountId);
  },

  async insertIncoming(input: { bankAccountId: string; amountCents: number; description: string | null }): Promise<IncomingMoneyRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync(
      'INSERT INTO incoming_money (id, bank_account_id, amount_cents, description, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      input.bankAccountId,
      input.amountCents,
      input.description,
      nowISO()
    );
    return (await db.getFirstAsync<IncomingMoneyRow>('SELECT * FROM incoming_money WHERE id = ?', id))!;
  },

  async deleteIncoming(accountId: string, incomingId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM incoming_money WHERE id = ? AND bank_account_id = ?', incomingId, accountId);
    return result.changes > 0;
  },
};
