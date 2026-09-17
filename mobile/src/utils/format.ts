const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function formatCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function todayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Presentational-only grouping label for a transaction feed ("Today" /
// "Yesterday" / a formatted date) - purely a display concern, no effect on
// how items are sorted or totaled.
export function dateGroupLabel(isoDate: string): string {
  const today = todayISODate();
  if (isoDate === today) return 'Today';
  const [year, month, day] = today.split('-').map(Number);
  const yesterday = new Date(year, month - 1, day - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  if (isoDate === `${yYear}-${yMonth}-${yDay}`) return 'Yesterday';
  return formatDate(isoDate);
}
