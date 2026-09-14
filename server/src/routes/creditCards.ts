import { Router } from 'express';
import { pool } from '../db';
import { EXPENSE_LIST_COLUMNS } from './expenses';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DUE_SOON_DAYS = 7;

interface CreditCardInput {
  name: string;
  bank: string;
  due_date: number;
}

function validateCreditCardInput(body: any): { errors: string[]; data?: CreditCardInput } {
  const errors: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push('name is required');

  const bank = typeof body.bank === 'string' ? body.bank.trim() : '';
  if (!bank) errors.push('bank is required');

  const dueDate = Number(body.dueDate);
  if (body.dueDate === undefined || body.dueDate === null || body.dueDate === '') {
    errors.push('dueDate is required');
  } else if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) {
    errors.push('dueDate must be a day of month between 1 and 31');
  }

  if (errors.length > 0) return { errors };

  return { errors: [], data: { name, bank, due_date: dueDate } };
}

// Returns the next occurrence of `dueDay` on or after `from`, clamped to the
// last day of any month shorter than `dueDay` (e.g. 31 -> Feb 28/29).
function nextDueDate(dueDay: number, from: Date): string {
  const clampToMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDay));
  };

  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = clampToMonth(today.getFullYear(), today.getMonth());
  if (candidate < today) {
    candidate = clampToMonth(today.getFullYear(), today.getMonth() + 1);
  }

  const year = candidate.getFullYear();
  const month = String(candidate.getMonth() + 1).padStart(2, '0');
  const day = String(candidate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function enrichCard(card: any, unpaid: number, todayISO: string) {
  const nextDue = nextDueDate(card.due_date, new Date());
  const daysUntilDue = daysBetween(todayISO, nextDue);

  let status: 'paid' | 'due_soon' | 'upcoming';
  if (unpaid <= 0) {
    status = 'paid';
  } else if (daysUntilDue <= DUE_SOON_DAYS) {
    status = 'due_soon';
  } else {
    status = 'upcoming';
  }

  return {
    ...card,
    unpaid: unpaid.toFixed(2),
    next_due_date: nextDue,
    days_until_due: daysUntilDue,
    status,
  };
}

async function getBalances(userId: number): Promise<Map<number, number>> {
  const [expenseSums, paymentSums] = await Promise.all([
    pool.query(
      `SELECT credit_card_id, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = $1 AND credit_card_id IS NOT NULL
       GROUP BY credit_card_id`,
      [userId]
    ),
    pool.query(
      `SELECT p.credit_card_id, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN credit_cards c ON c.id = p.credit_card_id
       WHERE c.user_id = $1
       GROUP BY p.credit_card_id`,
      [userId]
    ),
  ]);

  const balances = new Map<number, number>();
  for (const row of expenseSums.rows) {
    balances.set(row.credit_card_id, Number(row.total));
  }
  for (const row of paymentSums.rows) {
    balances.set(row.credit_card_id, (balances.get(row.credit_card_id) ?? 0) - Number(row.total));
  }
  return balances;
}

// GET /credit-cards
router.get('/', async (req, res) => {
  try {
    const cardsResult = await pool.query(`SELECT * FROM credit_cards WHERE user_id = $1`, [req.userId]);
    const balances = await getBalances(req.userId as number);
    const todayISO = new Date().toISOString().slice(0, 10);

    const cards = cardsResult.rows
      .map((card) => enrichCard(card, balances.get(card.id) ?? 0, todayISO))
      .sort((a, b) => a.days_until_due - b.days_until_due);

    res.json(cards);
  } catch (err) {
    console.error('Failed to fetch credit cards', err);
    res.status(500).json({ error: 'Failed to fetch credit cards' });
  }
});

// POST /credit-cards
router.post('/', async (req, res) => {
  const { errors, data } = validateCreditCardInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const result = await pool.query(
      `INSERT INTO credit_cards (user_id, name, bank, due_date) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, data.name, data.bank, data.due_date]
    );
    const todayISO = new Date().toISOString().slice(0, 10);
    res.status(201).json(enrichCard(result.rows[0], 0, todayISO));
  } catch (err) {
    console.error('Failed to create credit card', err);
    res.status(500).json({ error: 'Failed to create credit card' });
  }
});

// GET /credit-cards/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const cardResult = await pool.query(`SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const [transactionsResult, paymentsResult] = await Promise.all([
      pool.query(`SELECT ${EXPENSE_LIST_COLUMNS} FROM expenses WHERE credit_card_id = $1 ORDER BY date DESC, id DESC`, [id]),
      pool.query(`SELECT * FROM payments WHERE credit_card_id = $1 ORDER BY date DESC, id DESC`, [id]),
    ]);

    const totalExpenses = transactionsResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const totalPayments = paymentsResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const unpaid = totalExpenses - totalPayments;
    const todayISO = new Date().toISOString().slice(0, 10);

    res.json({
      card: enrichCard(cardResult.rows[0], unpaid, todayISO),
      transactions: transactionsResult.rows,
      payments: paymentsResult.rows,
    });
  } catch (err) {
    console.error('Failed to fetch credit card', err);
    res.status(500).json({ error: 'Failed to fetch credit card' });
  }
});

// PUT /credit-cards/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const { errors, data } = validateCreditCardInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const result = await pool.query(
      `UPDATE credit_cards SET name = $1, bank = $2, due_date = $3, updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [data.name, data.bank, data.due_date, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const balances = await getBalances(req.userId as number);
    const todayISO = new Date().toISOString().slice(0, 10);
    res.json(enrichCard(result.rows[0], balances.get(id) ?? 0, todayISO));
  } catch (err) {
    console.error('Failed to update credit card', err);
    res.status(500).json({ error: 'Failed to update credit card' });
  }
});

// DELETE /credit-cards/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(`DELETE FROM credit_cards WHERE id = $1 AND user_id = $2 RETURNING id`, [id, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete credit card', err);
    res.status(500).json({ error: 'Failed to delete credit card' });
  }
});

// POST /credit-cards/:id/payments
router.post('/:id/payments', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const errors: string[] = [];
  const amount = Number(req.body.amount);
  if (req.body.amount === undefined || req.body.amount === null || req.body.amount === '') {
    errors.push('amount is required');
  } else if (Number.isNaN(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }

  const date = typeof req.body.date === 'string' && req.body.date ? req.body.date : new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('date must be a valid date in YYYY-MM-DD format');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const cardResult = await pool.query(`SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const result = await pool.query(
      `INSERT INTO payments (credit_card_id, amount, date) VALUES ($1, $2, $3) RETURNING *`,
      [id, amount, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to record payment', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

const PAY_SOURCES = ['available', 'reservation'];

async function getCardOutstanding(client: import('pg').PoolClient, cardId: number): Promise<number> {
  const [expenseSum, paymentSum] = await Promise.all([
    client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE credit_card_id = $1`, [cardId]),
    client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE credit_card_id = $1`, [cardId]),
  ]);
  return Number(expenseSum.rows[0].total) - Number(paymentSum.rows[0].total);
}

// POST /credit-cards/:id/pay-from-account
// Pays a card from a bank account in one step: records the payment (not an
// expense), debits the account's actual balance, and — depending on the
// chosen source — either leaves reservations untouched (paying from the
// account's available money) or reduces/fulfills one specific reservation
// (paying from a reserved-money bucket, including partial payments).
router.post('/:id/pay-from-account', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const errors: string[] = [];
  const amount = Number(req.body.amount);
  if (req.body.amount === undefined || req.body.amount === null || req.body.amount === '') {
    errors.push('amount is required');
  } else if (Number.isNaN(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }

  const bankAccountId = Number(req.body.bankAccountId);
  if (req.body.bankAccountId === undefined || req.body.bankAccountId === null || req.body.bankAccountId === '') {
    errors.push('bankAccountId is required');
  } else if (Number.isNaN(bankAccountId)) {
    errors.push('bankAccountId must be numeric');
  }

  const source = typeof req.body.source === 'string' ? req.body.source : 'available';
  if (!PAY_SOURCES.includes(source)) {
    errors.push(`source must be one of: ${PAY_SOURCES.join(', ')}`);
  }

  const reservationId =
    req.body.reservationId !== undefined && req.body.reservationId !== null && req.body.reservationId !== ''
      ? Number(req.body.reservationId)
      : null;
  if (source === 'reservation') {
    if (reservationId === null) {
      errors.push('reservationId is required when source is "reservation"');
    } else if (Number.isNaN(reservationId)) {
      errors.push('reservationId must be numeric');
    }
  }

  const date = typeof req.body.date === 'string' && req.body.date ? req.body.date : new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('date must be a valid date in YYYY-MM-DD format');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cardResult = await client.query(`SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
      id,
      req.userId,
    ]);
    if (cardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const accountResult = await client.query(
      `SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [bankAccountId, req.userId]
    );
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const outstanding = await getCardOutstanding(client, id);
    if (amount > outstanding + 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Validation failed',
        details: [`Amount exceeds the card's outstanding balance (₱${outstanding.toFixed(2)})`],
      });
    }

    let reservation: any = null;
    if (source === 'reservation') {
      const reservationResult = await client.query(
        `SELECT * FROM reservations WHERE id = $1 AND bank_account_id = $2 AND status = 'reserved' FOR UPDATE`,
        [reservationId, bankAccountId]
      );
      if (reservationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reservation not found' });
      }
      reservation = reservationResult.rows[0];
      const reservationAmount = Number(reservation.amount);
      if (amount > reservationAmount + 0.005) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Validation failed',
          details: [`Amount exceeds the reservation's balance (₱${reservationAmount.toFixed(2)})`],
        });
      }
    } else {
      const activeReservationsResult = await client.query(
        `SELECT amount FROM reservations WHERE bank_account_id = $1 AND status = 'reserved' FOR UPDATE`,
        [bankAccountId]
      );
      const reserved = activeReservationsResult.rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const balance = Number(accountResult.rows[0].balance);
      const available = balance - reserved;
      if (amount > available + 0.005) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Validation failed',
          details: [`Amount exceeds the account's available balance (₱${available.toFixed(2)})`],
        });
      }
    }

    const paymentResult = await client.query(
      `INSERT INTO payments (credit_card_id, amount, date) VALUES ($1, $2, $3) RETURNING *`,
      [id, amount, date]
    );

    const accountUpdateResult = await client.query(
      `UPDATE bank_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [amount, bankAccountId]
    );

    let updatedReservation = null;
    if (reservation) {
      const remaining = Number(reservation.amount) - amount;
      if (remaining <= 0.005) {
        const result = await client.query(`UPDATE reservations SET amount = 0, status = 'fulfilled' WHERE id = $1 RETURNING *`, [
          reservation.id,
        ]);
        updatedReservation = result.rows[0];
      } else {
        const result = await client.query(`UPDATE reservations SET amount = $1 WHERE id = $2 RETURNING *`, [
          remaining,
          reservation.id,
        ]);
        updatedReservation = result.rows[0];
      }
    }

    await client.query('COMMIT');

    const reservedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM reservations WHERE bank_account_id = $1 AND status = 'reserved'`,
      [bankAccountId]
    );
    const reserved = Number(reservedResult.rows[0].total);
    const balance = Number(accountUpdateResult.rows[0].balance);

    res.status(201).json({
      payment: paymentResult.rows[0],
      account: { ...accountUpdateResult.rows[0], reserved: reserved.toFixed(2), available: (balance - reserved).toFixed(2) },
      reservation: updatedReservation,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to pay credit card from account', err);
    res.status(500).json({ error: 'Failed to pay credit card from account' });
  } finally {
    client.release();
  }
});

export default router;
