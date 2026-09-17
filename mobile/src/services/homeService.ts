import { homeRepository } from '../repositories/homeRepository';
import { expenseRepository } from '../repositories/expenseRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { bankAccountService } from './bankAccountService';
import { creditCardService } from './creditCardService';
import { recurringPaymentService } from './recurringPaymentService';
import { toExpense, type Expense } from './expenseService';
import { fromCents } from '../utils/money';

export type RecentExpensesPeriod = 'today' | 'week' | 'month';

// Order here is display order on Home (recent activity first, then
// accounts, then what's coming up) - purely presentational, no effect on
// what each section contains.
export const HOME_SECTION_KEYS = ['recentExpenses', 'accountOverview', 'upcomingDue', 'reservedMoney', 'monthlySummary', 'spendingByCategory'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const DEFAULT_VISIBLE_SECTIONS: HomeSectionKey[] = ['recentExpenses', 'accountOverview', 'upcomingDue', 'reservedMoney', 'monthlySummary'];

const SECTIONS_SETTING_KEY = 'home.visibleSections';
const PERIOD_SETTING_KEY = 'home.recentExpensesPeriod';

export interface HomeOverview {
  totalAvailable: string;
  totalReserved: string;
  totalCreditCardOutstanding: string;
  dueSoonCount: number;
}

export interface MonthlySummary {
  spent: string;
  income: string;
  net: string;
}

export interface ReservationSummaryItem {
  id: string;
  accountName: string;
  name: string;
  amount: string;
}

export interface UpcomingItem {
  id: string;
  label: string;
  detail: string;
  date: string;
  amount: string;
}

export interface HomeData {
  overview: HomeOverview;
  monthlySummary: MonthlySummary;
  categoryTotals: { category: string; total: string }[];
  recentExpenses: Expense[];
  reservations: ReservationSummaryItem[];
  upcoming: UpcomingItem[];
  visibleSections: HomeSectionKey[];
  recentExpensesPeriod: RecentExpensesPeriod;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodRange(period: RecentExpensesPeriod, today: Date): { start: string; end: string } {
  const end = toISO(today);
  if (period === 'today') return { start: end, end };
  if (period === 'week') {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(start.getDate() - daysSinceMonday);
    return { start: toISO(start), end };
  }
  return { start: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), end };
}

function monthRange(today: Date): { start: string; end: string } {
  return {
    start: toISO(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: toISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

export const homeService = {
  async getRecentExpensesPeriod(): Promise<RecentExpensesPeriod> {
    const value = await settingsRepository.get(PERIOD_SETTING_KEY);
    return value === 'today' || value === 'week' || value === 'month' ? value : 'week';
  },

  async setRecentExpensesPeriod(period: RecentExpensesPeriod): Promise<void> {
    await settingsRepository.set(PERIOD_SETTING_KEY, period);
  },

  async getVisibleSections(): Promise<HomeSectionKey[]> {
    const value = await settingsRepository.get(SECTIONS_SETTING_KEY);
    if (!value) return DEFAULT_VISIBLE_SECTIONS;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((k): k is HomeSectionKey => HOME_SECTION_KEYS.includes(k)) : DEFAULT_VISIBLE_SECTIONS;
    } catch {
      return DEFAULT_VISIBLE_SECTIONS;
    }
  },

  async setVisibleSections(sections: HomeSectionKey[]): Promise<void> {
    await settingsRepository.set(SECTIONS_SETTING_KEY, JSON.stringify(sections));
  },

  async getHomeData(): Promise<HomeData> {
    const today = new Date();
    const [accounts, cards, recurring, visibleSections, recentExpensesPeriod, reservations] = await Promise.all([
      bankAccountService.listAccounts(),
      creditCardService.listCards(),
      recurringPaymentService.listUpcoming(5),
      homeService.getVisibleSections(),
      homeService.getRecentExpensesPeriod(),
      homeRepository.allActiveReservations(),
    ]);

    const totalAvailableCents = accounts.reduce((sum, a) => sum + Number(a.available) * 100, 0);
    const totalReservedCents = accounts.reduce((sum, a) => sum + Number(a.reserved) * 100, 0);
    const totalOutstandingCents = cards.reduce((sum, c) => sum + Number(c.unpaid) * 100, 0);
    const dueSoonCount = cards.filter((c) => c.status === 'due_soon').length;

    const { start: monthStart, end: monthEnd } = monthRange(today);
    const [spentCents, incomeCents, categoryTotals] = await Promise.all([
      expenseRepository.totalForDateRange(monthStart, monthEnd),
      homeRepository.incomeForDateRange(monthStart, monthEnd),
      expenseRepository.categoryTotalsForDateRange(monthStart, monthEnd),
    ]);

    const { start: recentStart, end: recentEnd } = periodRange(recentExpensesPeriod, today);
    const recentRows = await expenseRepository.forDateRange(recentStart, recentEnd);

    const upcoming: UpcomingItem[] = [
      ...cards
        .filter((c) => Number(c.unpaid) > 0)
        .map((c) => ({ id: `card-${c.id}`, label: c.name, detail: 'Credit card due', date: c.next_due_date, amount: c.unpaid })),
      ...recurring.map((r) => ({ id: `recurring-${r.id}`, label: r.name, detail: r.credit_card_name, date: r.next_date, amount: r.amount })),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return {
      overview: {
        totalAvailable: fromCents(Math.round(totalAvailableCents)),
        totalReserved: fromCents(Math.round(totalReservedCents)),
        totalCreditCardOutstanding: fromCents(Math.round(totalOutstandingCents)),
        dueSoonCount,
      },
      monthlySummary: {
        spent: fromCents(spentCents),
        income: fromCents(incomeCents),
        net: fromCents(incomeCents - spentCents),
      },
      categoryTotals: categoryTotals.map((c) => ({ category: c.category, total: fromCents(c.total) })),
      recentExpenses: recentRows.map(toExpense),
      reservations: reservations.map((r) => ({ id: r.id, accountName: r.account_name, name: r.name, amount: fromCents(r.amount_cents) })),
      upcoming,
      visibleSections,
      recentExpensesPeriod,
    };
  },
};
