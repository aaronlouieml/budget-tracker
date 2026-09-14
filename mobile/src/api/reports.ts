import { apiRequest } from './client';

export type ReportPeriod = 'week' | 'month' | 'year';

export interface ReportCategoryTotal {
  category: string;
  total: string;
}

export interface ReportSeriesPoint {
  label: string;
  total: number;
}

export interface ReportData {
  period: ReportPeriod;
  rangeStart: string;
  rangeEnd: string;
  totalExpenses: string;
  categoryTotals: ReportCategoryTotal[];
  spendingOverTime: ReportSeriesPoint[];
}

export function fetchReport(token: string, period: ReportPeriod) {
  return apiRequest<ReportData>(`/reports?period=${period}`, { token });
}
