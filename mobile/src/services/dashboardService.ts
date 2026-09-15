import { expenseRepository } from '../repositories/expenseRepository';
import { fromCents } from '../utils/money';
import { toExpense, type Expense } from './expenseService';

export interface DashboardData {
  totalExpenses: string;
  categoryTotals: { category: string; total: string }[];
  recentExpenses: Expense[];
}

function monthRange(today: Date): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: toISO(start), end: toISO(end) };
}

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const { start, end } = monthRange(new Date());
    const [totalCents, categoryTotals, recent] = await Promise.all([
      expenseRepository.totalForDateRange(start, end),
      expenseRepository.categoryTotalsForDateRange(start, end),
      expenseRepository.recent(5),
    ]);

    return {
      totalExpenses: fromCents(totalCents),
      categoryTotals: categoryTotals.map((c) => ({ category: c.category, total: fromCents(c.total) })),
      recentExpenses: recent.map(toExpense),
    };
  },
};
