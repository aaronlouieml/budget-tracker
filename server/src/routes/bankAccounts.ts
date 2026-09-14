import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const ACCOUNT_TYPES = ['savings', 'checking', 'cash', 'ewallet'];
const PURPOSES = ['credit_card_payment', 'bill', 'other'];

interface AccountInput {
  name: string;
  type: string;
  balance: number;
}

function validateAccountInput(body: any): { errors: string[]; data?: AccountInput } {
  const errors: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push('name is required');

  const type = typeof body.type === 'string' ? body.type : '';
  if (!type) {
    errors.push('type is required');
  } else if (!ACCOUNT_TYPES.includes(type)) {
    errors.push(`type must be one of: ${ACCOUNT_TYPES.join(', ')}`);
  }

  const balance = Number(body.balance);
  if (body.balance === undefined || body.balance === null || body.balance === '') {
    errors.push('balance is required');
  } else if (Number.isNaN(balance)) {
    errors.push('balance must be numeric');
  }

  if (errors.length > 0) return { errors };

  return { errors: [], data: { name, type, balance } };
}

async function getReservedTotals(userId: number): Promise<Map<number, number>> {
  const result = await pool.query(
    `SELECT r.bank_account_id, COALESCE(SUM(r.amount), 0) AS total
     FROM reservations r
     JOIN bank_accounts a ON a.id = r.bank_account_id
     WHERE a.user_id = $1 AND r.status = 'reserved'
     GROUP BY r.bank_account_id`,
    [userId]
  );
  const totals = new Map<number, number>();
  for (const row of result.rows) {
    totals.set(row.bank_account_id, Number(row.total));
  }
  return totals;
}

function enrichAccount(account: any, reserved: number) {
  const balance = Number(account.balance);
  const available = balance - reserved;
  return {
    ...account,
    reserved: reserved.toFixed(2),
    available: available.toFixed(2),
  };
}

// GET /bank-accounts
router.get('/', async (req, res) => {
  try {
    const accountsResult = await pool.query(`SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY created_at ASC`, [
      req.userId,
    ]);
    const reservedTotals = await getReservedTotals(req.userId as number);

    const accounts = accountsResult.rows.map((account) => enrichAccount(account, reservedTotals.get(account.id) ?? 0));
    res.json(accounts);
  } catch (err) {
    console.error('Failed to fetch bank accounts', err);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// POST /bank-accounts
router.post('/', async (req, res) => {
  const { errors, data } = validateAccountInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const result = await pool.query(
      `INSERT INTO bank_accounts (user_id, name, type, balance) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, data.name, data.type, data.balance]
    );
    res.status(201).json(enrichAccount(result.rows[0], 0));
  } catch (err) {
    console.error('Failed to create bank account', err);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// GET /bank-accounts/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const accountResult = await pool.query(`SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const [reservationsResult, incomingResult] = await Promise.all([
      pool.query(
        `SELECT r.*, c.name AS credit_card_name
         FROM reservations r
         LEFT JOIN credit_cards c ON c.id = r.credit_card_id
         WHERE r.bank_account_id = $1
         ORDER BY r.created_at DESC`,
        [id]
      ),
      pool.query(`SELECT * FROM incoming_money WHERE bank_account_id = $1 ORDER BY created_at DESC`, [id]),
    ]);

    const reserved = reservationsResult.rows
      .filter((r) => r.status === 'reserved')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const incomingTotal = incomingResult.rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const account = enrichAccount(accountResult.rows[0], reserved);

    res.json({
      account,
      reservations: reservationsResult.rows,
      incoming: incomingResult.rows,
      incomingTotal: incomingTotal.toFixed(2),
      potentialAvailable: (Number(account.available) + incomingTotal).toFixed(2),
    });
  } catch (err) {
    console.error('Failed to fetch bank account', err);
    res.status(500).json({ error: 'Failed to fetch bank account' });
  }
});

// PUT /bank-accounts/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const { errors, data } = validateAccountInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const result = await pool.query(
      `UPDATE bank_accounts SET name = $1, type = $2, balance = $3, updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [data.name, data.type, data.balance, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const reservedTotals = await getReservedTotals(req.userId as number);
    res.json(enrichAccount(result.rows[0], reservedTotals.get(id) ?? 0));
  } catch (err) {
    console.error('Failed to update bank account', err);
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

// DELETE /bank-accounts/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(`DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2 RETURNING id`, [
      id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete bank account', err);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

interface ReservationInput {
  name: string;
  amount: number;
  purpose: string;
  creditCardId: number | null;
}

function validateReservationInput(body: any): { errors: string[]; data?: ReservationInput } {
  const errors: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push('name is required');

  const amount = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === '') {
    errors.push('amount is required');
  } else if (Number.isNaN(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }

  const purpose = typeof body.purpose === 'string' ? body.purpose : '';
  if (!purpose) {
    errors.push('purpose is required');
  } else if (!PURPOSES.includes(purpose)) {
    errors.push(`purpose must be one of: ${PURPOSES.join(', ')}`);
  }

  const creditCardId = body.creditCardId !== undefined && body.creditCardId !== null && body.creditCardId !== '' ? Number(body.creditCardId) : null;
  if (creditCardId !== null && Number.isNaN(creditCardId)) {
    errors.push('creditCardId must be numeric');
  }

  if (errors.length > 0) return { errors };

  return { errors: [], data: { name, amount, purpose, creditCardId } };
}

// POST /bank-accounts/:id/reservations
router.post('/:id/reservations', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const { errors, data } = validateReservationInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  const { name, amount, purpose, creditCardId } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const accountResult = await client.query(`SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
      id,
      req.userId,
    ]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bank account not found' });
    }

    if (creditCardId !== null) {
      const cardResult = await client.query(`SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2`, [
        creditCardId,
        req.userId,
      ]);
      if (cardResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Validation failed', details: ['creditCardId does not refer to a valid card'] });
      }
    }

    const existingResult = await client.query(
      `SELECT amount FROM reservations WHERE bank_account_id = $1 AND status = 'reserved' FOR UPDATE`,
      [id]
    );
    const existingReserved = existingResult.rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const balance = Number(accountResult.rows[0].balance);
    const availableForReservation = balance - existingReserved;

    if (amount > availableForReservation + 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Validation failed',
        details: [`Cannot reserve more than the available balance (₱${availableForReservation.toFixed(2)} available)`],
      });
    }

    const result = await client.query(
      `INSERT INTO reservations (bank_account_id, name, amount, purpose, credit_card_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, name, amount, purpose, creditCardId]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to create reservation', err);
    res.status(500).json({ error: 'Failed to create reservation' });
  } finally {
    client.release();
  }
});

// PUT /bank-accounts/:id/reservations/:reservationId
router.put('/:id/reservations/:reservationId', async (req, res) => {
  const id = Number(req.params.id);
  const reservationId = Number(req.params.reservationId);
  if (Number.isNaN(id) || Number.isNaN(reservationId)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const { errors, data } = validateReservationInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  const { name, amount, purpose, creditCardId } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const accountResult = await client.query(`SELECT * FROM bank_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
      id,
      req.userId,
    ]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const reservationResult = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND bank_account_id = $2 AND status = 'reserved' FOR UPDATE`,
      [reservationId, id]
    );
    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (creditCardId !== null) {
      const cardResult = await client.query(`SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2`, [
        creditCardId,
        req.userId,
      ]);
      if (cardResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Validation failed', details: ['creditCardId does not refer to a valid card'] });
      }
    }

    const otherResult = await client.query(
      `SELECT amount FROM reservations WHERE bank_account_id = $1 AND status = 'reserved' AND id != $2 FOR UPDATE`,
      [id, reservationId]
    );
    const otherReserved = otherResult.rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const balance = Number(accountResult.rows[0].balance);
    const availableForReservation = balance - otherReserved;

    if (amount > availableForReservation + 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Validation failed',
        details: [`Cannot reserve more than the available balance (₱${availableForReservation.toFixed(2)} available)`],
      });
    }

    const result = await client.query(
      `UPDATE reservations SET name = $1, amount = $2, purpose = $3, credit_card_id = $4 WHERE id = $5 RETURNING *`,
      [name, amount, purpose, creditCardId, reservationId]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update reservation', err);
    res.status(500).json({ error: 'Failed to update reservation' });
  } finally {
    client.release();
  }
});

// DELETE /bank-accounts/:id/reservations/:reservationId
router.delete('/:id/reservations/:reservationId', async (req, res) => {
  const id = Number(req.params.id);
  const reservationId = Number(req.params.reservationId);
  if (Number.isNaN(id) || Number.isNaN(reservationId)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM reservations r USING bank_accounts a
       WHERE r.id = $1 AND r.bank_account_id = $2 AND a.id = r.bank_account_id AND a.user_id = $3
       RETURNING r.id`,
      [reservationId, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete reservation', err);
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

// POST /bank-accounts/:id/incoming
router.post('/:id/incoming', async (req, res) => {
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

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const description = typeof req.body.description === 'string' ? req.body.description.trim() || null : null;

  try {
    const accountResult = await pool.query(`SELECT id FROM bank_accounts WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const result = await pool.query(
      `INSERT INTO incoming_money (bank_account_id, amount, description) VALUES ($1, $2, $3) RETURNING *`,
      [id, amount, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to record incoming money', err);
    res.status(500).json({ error: 'Failed to record incoming money' });
  }
});

// DELETE /bank-accounts/:id/incoming/:incomingId
router.delete('/:id/incoming/:incomingId', async (req, res) => {
  const id = Number(req.params.id);
  const incomingId = Number(req.params.incomingId);
  if (Number.isNaN(id) || Number.isNaN(incomingId)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM incoming_money i USING bank_accounts a
       WHERE i.id = $1 AND i.bank_account_id = $2 AND a.id = i.bank_account_id AND a.user_id = $3
       RETURNING i.id`,
      [incomingId, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incoming money entry not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete incoming money entry', err);
    res.status(500).json({ error: 'Failed to delete incoming money entry' });
  }
});

export default router;
