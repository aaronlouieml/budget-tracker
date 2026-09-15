import { expenseRepository } from '../repositories/expenseRepository';
import { fromCents } from '../utils/money';
import { ServiceError } from './errors';

export type Period = 'week' | 'month' | 'year';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ReportData {
  period: Period;
  rangeStart: string;
  rangeEnd: string;
  totalExpenses: string;
  categoryTotals: { category: string; total: string }[];
  spendingOverTime: { label: string; total: number }[];
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getRange(period: Period, today: Date): { start: Date; end: Date } {
  if (period === 'week') {
    const dayOfWeek = today.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const start = addDays(today, -daysSinceMonday);
    return { start, end: addDays(start, 6) };
  }
  if (period === 'month') {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
  }
  return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
}

function buildSeries(period: Period, start: Date, end: Date, dailyTotals: Map<string, number>): { label: string; total: number }[] {
  if (period === 'week') {
    return Array.from({ length: 7 }, (_, i) => ({ label: WEEKDAY_LABELS[i], total: dailyTotals.get(toISODate(addDays(start, i))) ?? 0 }));
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
    series[Number(dateStr.slice(5, 7)) - 1].total += amount;
  }
  return series;
}

export const reportService = {
  async getReport(period: Period): Promise<ReportData> {
    if (period !== 'week' && period !== 'month' && period !== 'year') {
      throw new ServiceError(['period must be one of: week, month, year']);
    }

    const { start, end } = getRange(period, new Date());
    const rangeStart = toISODate(start);
    const rangeEnd = toISODate(end);

    const [totalCents, categoryTotals, dailyRows] = await Promise.all([
      expenseRepository.totalForDateRange(rangeStart, rangeEnd),
      expenseRepository.categoryTotalsForDateRange(rangeStart, rangeEnd),
      expenseRepository.dailyTotalsForDateRange(rangeStart, rangeEnd),
    ]);

    const dailyTotals = new Map<string, number>(dailyRows.map((r) => [r.date, r.total]));
    // spendingOverTime stays in cents/100 (whole currency units) since it feeds
    // a chart, not a formatted label - matches the old API's numeric output.
    const series = buildSeries(period, start, end, dailyTotals).map((s) => ({ label: s.label, total: s.total / 100 }));

    return {
      period,
      rangeStart,
      rangeEnd,
      totalExpenses: fromCents(totalCents),
      categoryTotals: categoryTotals.map((c) => ({ category: c.category, total: fromCents(c.total) })),
      spendingOverTime: series,
    };
  },
};
