import { Router } from 'express';
import { pool } from '../db';
import { EXPENSE_LIST_COLUMNS } from './expenses';

const router = Router();

// GET /dashboard
router.get('/', async (req, res) => {
  try {
    const [totalResult, categoryResult, recentResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE user_id = $1 AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)`,
        [req.userId]
      ),
      pool.query(
        `SELECT category, SUM(amount) AS total
         FROM expenses
         WHERE user_id = $1 AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
         GROUP BY category
         ORDER BY total DESC`,
        [req.userId]
      ),
      pool.query(
        `SELECT ${EXPENSE_LIST_COLUMNS} FROM expenses WHERE user_id = $1 ORDER BY date DESC, id DESC LIMIT 5`,
        [req.userId]
      ),
    ]);

    res.json({
      totalExpenses: totalResult.rows[0].total,
      categoryTotals: categoryResult.rows,
      recentExpenses: recentResult.rows,
    });
  } catch (err) {
    console.error('Failed to load dashboard', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
