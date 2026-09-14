import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ExpenseInput {
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: number | null;
  receipt_image: string | null;
}

function validateExpenseInput(body: any): { errors: string[]; data?: ExpenseInput } {
  const errors: string[] = [];

  const amount = Number(body.amount);
  if (body.amount === undefined || body.amount === null || body.amount === '') {
    errors.push('amount is required');
  } else if (Number.isNaN(amount)) {
    errors.push('amount must be numeric');
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category) {
    errors.push('category is required');
  }

  const date = typeof body.date === 'string' ? body.date : '';
  if (!date) {
    errors.push('date is required');
  } else if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('date must be a valid date in YYYY-MM-DD format');
  }

  if (body.credit_card_id !== undefined && body.credit_card_id !== null && Number.isNaN(Number(body.credit_card_id))) {
    errors.push('credit_card_id must be numeric');
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    data: {
      amount,
      category,
      date,
      merchant: body.merchant ?? null,
      payment_method: body.payment_method ?? null,
      credit_card_id: body.credit_card_id !== undefined && body.credit_card_id !== null ? Number(body.credit_card_id) : null,
      receipt_image: body.receipt_image ?? null,
    },
  };
}

// POST /expenses
router.post('/', async (req, res) => {
  const { errors, data } = validateExpenseInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const result = await pool.query(
      `INSERT INTO expenses (user_id, amount, category, date, merchant, payment_method, credit_card_id, receipt_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, data.amount, data.category, data.date, data.merchant, data.payment_method, data.credit_card_id, data.receipt_image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create expense', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Columns for list views - excludes receipt_image, which can be a large base64
// blob that's never displayed in a list and would otherwise bloat every response.
export const EXPENSE_LIST_COLUMNS = `id, user_id, amount, category, date, merchant, payment_method, credit_card_id, created_at, updated_at`;

// GET /expenses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${EXPENSE_LIST_COLUMNS} FROM expenses WHERE user_id = $1 ORDER BY date DESC, id DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch expenses', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /expenses/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch expense', err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// PUT /expenses/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  const { errors, data } = validateExpenseInput(req.body);
  if (errors.length > 0 || !data) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    // receipt_image is omitted from list responses (see EXPENSE_LIST_COLUMNS), so
    // the mobile app can't round-trip it on an ordinary edit - COALESCE keeps the
    // existing stored receipt unless the request explicitly provides a new one.
    const result = await pool.query(
      `UPDATE expenses
       SET amount = $1, category = $2, date = $3, merchant = $4, payment_method = $5,
           credit_card_id = $6, receipt_image = COALESCE($7, receipt_image), updated_at = now()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [data.amount, data.category, data.date, data.merchant, data.payment_method, data.credit_card_id, data.receipt_image, id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update expense', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /expenses/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id must be numeric' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete expense', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
