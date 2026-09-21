import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';
import { calculateResponsibility } from '../services/financialMath';
import { allocatePayments } from '../services/debtAllocation';

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
  category: string | null;
  planned_date: string | null;
  fulfilled_at: string | null;
  fulfilled_via: 'release' | 'payment' | null;
  created_at: string;
}

export interface IncomingMoneyRow {
  id: string;
  bank_account_id: string;
  amount_cents: number;
  description: string | null;
  status: string;
  received_at: string | null;
  source_type: string;
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

  async findReservationById(reservationId: string): Promise<ReservationRow | null> {
    const db = await getDb();
    return db.getFirstAsync<ReservationRow>('SELECT * FROM reservations WHERE id = ?', reservationId);
  },

  async insertReservation(input: {
    bankAccountId: string;
    name: string;
    amountCents: number;
    purpose: string;
    creditCardId: string | null;
    category: string | null;
    plannedDate: string | null;
  }): Promise<ReservationRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync(
      `INSERT INTO reservations (id, bank_account_id, name, amount_cents, purpose, credit_card_id, status, category, planned_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`,
      id,
      input.bankAccountId,
      input.name,
      input.amountCents,
      input.purpose,
      input.creditCardId,
      input.category,
      input.plannedDate,
      nowISO()
    );
    return (await db.getFirstAsync<ReservationRow>('SELECT * FROM reservations WHERE id = ?', id))!;
  },

  async updateReservation(
    reservationId: string,
    input: {
      name: string;
      amountCents: number;
      purpose: string;
      creditCardId: string | null;
      category: string | null;
      plannedDate: string | null;
    }
  ): Promise<ReservationRow | null> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE reservations SET name = ?, amount_cents = ?, purpose = ?, credit_card_id = ?, category = ?, planned_date = ? WHERE id = ?`,
      input.name,
      input.amountCents,
      input.purpose,
      input.creditCardId,
      input.category,
      input.plannedDate,
      reservationId
    );
    return db.getFirstAsync<ReservationRow>('SELECT * FROM reservations WHERE id = ?', reservationId);
  },

  // Sets a reservation's remaining amount and status. When it becomes
  // 'fulfilled', records when and how (a real payment/expense already has its
  // own activity row; a manual 'release' is what Recent Activity lists).
  // Re-opening it ('reserved') clears that record.
  async setReservationAmount(
    reservationId: string,
    amountCents: number,
    status: string,
    fulfilledVia: 'release' | 'payment' | null = null
  ): Promise<void> {
    const db = await getDb();
    const fulfilled = status === 'fulfilled';
    await db.runAsync(
      'UPDATE reservations SET amount_cents = ?, status = ?, fulfilled_at = ?, fulfilled_via = ? WHERE id = ?',
      amountCents,
      status,
      fulfilled ? nowISO() : null,
      fulfilled ? fulfilledVia ?? 'payment' : null,
      reservationId
    );
  },

  // Manual "mark as used": keeps the amount (so it can be shown in activity)
  // and only flips the status - the money was never moved.
  async markReservationReleased(reservationId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE reservations SET status = 'fulfilled', fulfilled_at = ?, fulfilled_via = 'release' WHERE id = ?",
      nowISO(),
      reservationId
    );
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

  async insertIncoming(input: {
    bankAccountId: string;
    amountCents: number;
    description: string | null;
    sourceType?: string;
  }): Promise<IncomingMoneyRow> {
    const db = await getDb();
    const id = newId();
    await db.runAsync(
      `INSERT INTO incoming_money (id, bank_account_id, amount_cents, description, status, source_type, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      id,
      input.bankAccountId,
      input.amountCents,
      input.description,
      input.sourceType ?? 'manual',
      nowISO()
    );
    return (await db.getFirstAsync<IncomingMoneyRow>('SELECT * FROM incoming_money WHERE id = ?', id))!;
  },

  // Money that's already real the moment it's recorded (e.g. a manual
  // "Add Money" deposit) - unlike insertIncoming, which starts 'pending'
  // until confirmIncoming later marks it received.
  async insertDeposit(input: { bankAccountId: string; amountCents: number; description: string | null; sourceType: string }): Promise<IncomingMoneyRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.runAsync(
      `INSERT INTO incoming_money (id, bank_account_id, amount_cents, description, status, source_type, received_at, created_at)
       VALUES (?, ?, ?, ?, 'received', ?, ?, ?)`,
      id,
      input.bankAccountId,
      input.amountCents,
      input.description,
      input.sourceType,
      now,
      now
    );
    return (await db.getFirstAsync<IncomingMoneyRow>('SELECT * FROM incoming_money WHERE id = ?', id))!;
  },

  async findIncoming(accountId: string, incomingId: string): Promise<IncomingMoneyRow | null> {
    const db = await getDb();
    return db.getFirstAsync<IncomingMoneyRow>('SELECT * FROM incoming_money WHERE id = ? AND bank_account_id = ?', incomingId, accountId);
  },

  async confirmIncoming(accountId: string, incomingId: string): Promise<IncomingMoneyRow | null> {
    const db = await getDb();
    const now = nowISO();
    await db.runAsync(
      `UPDATE incoming_money SET status = 'received', received_at = ? WHERE id = ? AND bank_account_id = ? AND status = 'pending'`,
      now,
      incomingId,
      accountId
    );
    return this.findIncoming(accountId, incomingId);
  },

  async deleteIncoming(accountId: string, incomingId: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM incoming_money WHERE id = ? AND bank_account_id = ?', incomingId, accountId);
    return result.changes > 0;
  },

  // Mirrors creditCardRepository.responsibilityTotals exactly, with
  // bank_account_id in place of credit_card_id - bank accounts have no
  // opening_balance_cents column (unlike credit cards), so myResponsibility
  // here is the raw shared-expense split with no addend.
  async responsibilityTotals(accountId: string): Promise<{ myResponsibilityCents: number; othersOweCents: number }> {
    const db = await getDb();
    const expenseRows = await db.getAllAsync<{ amount_cents: number; shares_total: number }>(
      `SELECT e.amount_cents AS amount_cents, COALESCE(SUM(es.amount_cents), 0) AS shares_total
     FROM expenses e
     LEFT JOIN expense_shares es ON es.expense_id = e.id
     WHERE e.bank_account_id = ?
     GROUP BY e.id`,
      accountId
    );
    const { myResponsibilityCents } = calculateResponsibility(
      expenseRows.map((r) => ({ amountCents: r.amount_cents, sharesTotalCents: r.shares_total }))
    );

    const accountShares = await db.getAllAsync<{ id: string; person_id: string }>(
      `SELECT es.id, es.person_id FROM expense_shares es JOIN expenses e ON e.id = es.expense_id WHERE e.bank_account_id = ?`,
      accountId
    );
    const personIds = [...new Set(accountShares.map((s) => s.person_id))];

    let othersOweCents = 0;
    for (const personId of personIds) {
      const allShares = await db.getAllAsync<{ id: string; amount_cents: number }>(
        `SELECT es.id, es.amount_cents FROM expense_shares es JOIN expenses e ON e.id = es.expense_id WHERE es.person_id = ? ORDER BY e.date ASC, es.created_at ASC`,
        personId
      );
      const paymentRow = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM debt_payments WHERE person_id = ?',
        personId
      );
      const allocations = allocatePayments(
        allShares.map((s) => ({ id: s.id, amountCents: s.amount_cents })),
        paymentRow?.total ?? 0
      );
      for (const share of accountShares) {
        if (share.person_id !== personId) continue;
        othersOweCents += allocations.get(share.id)?.remainingCents ?? 0;
      }
    }

    return { myResponsibilityCents, othersOweCents };
  },
};
