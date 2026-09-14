import { Router } from 'express';
import { pool } from '../db';

const router = Router();

type Period = 'week' | 'month' | 'year';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Returns the inclusive [start, end] date range for the period containing "today".
function getRange(period: Period, today: Date): { start: Date; end: Date } {
  if (period === 'week') {
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const start = addDays(today, -daysSinceMonday);
    const end = addDays(start, 6);
    return { start, end };
  }

  if (period === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end };
  }

  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  return { start, end };
}

// Buckets a date -> amount map into the chart series for the given period.
function buildSeries(period: Period, start: Date, end: Date, dailyTotals: Map<string, number>): { label: string; total: number }[] {
  if (period === 'week') {
    const series = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      series.push({ label: WEEKDAY_LABELS[i], total: dailyTotals.get(toISODate(date)) ?? 0 });
    }
    return series;
  }

  if (period === 'month') {
    const daysInMonth = end.getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const series = Array.from({ length: weekCount }, (_, i) => ({ label: `Week ${i + 1}`, total: 0 }));
    for (const [dateStr, amount] of dailyTotals) {
      const day = Number(dateStr.slice(8, 10));
      const weekIndex = Math.min(Math.floor((day - 1) / 7), weekCount - 1);
      series[weekIndex].total += amount;
    }
    return series;
  }

  const series = MONTH_LABELS.map((label) => ({ label, total: 0 }));
  for (const [dateStr, amount] of dailyTotals) {
    const monthIndex = Number(dateStr.slice(5, 7)) - 1;
    series[monthIndex].total += amount;
  }
  return series;
}

// GET /reports?period=week|month|year
router.get('/', async (req, res) => {
  const period = req.query.period;
  if (period !== 'week' && period !== 'month' && period !== 'year') {
    return res.status(400).json({ error: 'Validation failed', details: ['period must be one of: week, month, year'] });
  }

  try {
    const { start, end } = getRange(period, new Date());
    const rangeStart = toISODate(start);
    const rangeEnd = toISODate(end);

    const [totalResult, categoryResult, dailyResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [req.userId, rangeStart, rangeEnd]
      ),
      pool.query(
        `SELECT category, SUM(amount) AS total FROM expenses
         WHERE user_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY category ORDER BY total DESC`,
        [req.userId, rangeStart, rangeEnd]
      ),
      pool.query(
        `SELECT date, SUM(amount) AS total FROM expenses
         WHERE user_id = $1 AND date BETWEEN $2 AND $3
         GROUP BY date`,
        [req.userId, rangeStart, rangeEnd]
      ),
    ]);

    const dailyTotals = new Map<string, number>(dailyResult.rows.map((row) => [row.date, Number(row.total)]));

    res.json({
      period,
      rangeStart,
      rangeEnd,
      totalExpenses: totalResult.rows[0].total,
      categoryTotals: categoryResult.rows,
      spendingOverTime: buildSeries(period, start, end, dailyTotals),
    });
  } catch (err) {
    console.error('Failed to load report', err);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

export default router;
