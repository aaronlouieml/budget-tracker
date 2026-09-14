import { apiRequest } from './client';
import type { Expense } from './expenses';

export interface CategoryTotal {
  category: string;
  total: string;
}

export interface DashboardData {
  totalExpenses: string;
  categoryTotals: CategoryTotal[];
  recentExpenses: Expense[];
}

export function fetchDashboard(token: string) {
  return apiRequest<DashboardData>('/dashboard', { token });
}
