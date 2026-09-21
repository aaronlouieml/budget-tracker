import { formatCurrency, formatShortDate } from './format';

// The parts of a person's Money Owed detail needed to write a plain-text
// message. Kept as a structural type (not importing personService) so this
// stays free of any DB/RN imports and is easy to unit test.
export interface OwedMessageInput {
  name: string;
  total: string;
  openingOwed: string;
  shares: {
    amount: string;
    remaining: string;
    status: 'paid' | 'owes';
    expense: { merchant: string | null; category: string; date: string };
  }[];
  payments: { amount: string; date: string }[];
}

// Plain-text summary of what someone owes, formatted to paste straight into
// a chat: itemised shared expenses (oldest first), payments received, and
// the total still owed.
export function formatOwedMessage(input: OwedMessageInput): string {
  const lines: string[] = [`Hi ${input.name}! Here's a summary of what you owe me:`, ''];

  if (Number(input.openingOwed) > 0) {
    lines.push(`Previous balance: ${formatCurrency(input.openingOwed)}`);
  }

  const shares = [...input.shares].sort((a, b) => a.expense.date.localeCompare(b.expense.date));
  if (shares.length > 0) {
    lines.push('Shared expenses:');
    for (const share of shares) {
      const label = share.expense.merchant || share.expense.category;
      const status = share.status === 'paid' ? 'paid' : `${formatCurrency(share.remaining)} left`;
      lines.push(`• ${formatShortDate(share.expense.date)} - ${label}: ${formatCurrency(share.amount)} (${status})`);
    }
  }

  const payments = [...input.payments].sort((a, b) => a.date.localeCompare(b.date));
  if (payments.length > 0) {
    lines.push('Payments received:');
    for (const payment of payments) {
      lines.push(`• ${formatShortDate(payment.date)}: ${formatCurrency(payment.amount)}`);
    }
  }

  lines.push('', `Total owed: ${formatCurrency(input.total)}`);
  return lines.join('\n');
}
