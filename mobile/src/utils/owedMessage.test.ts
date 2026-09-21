import { formatOwedMessage } from './owedMessage';

const share = (date: string, merchant: string | null, amount: string, remaining: string) => ({
  amount,
  remaining,
  status: Number(remaining) <= 0 ? ('paid' as const) : ('owes' as const),
  expense: { merchant, category: 'Food', date },
});

describe('formatOwedMessage', () => {
  it('lists shared expenses oldest first, marks paid vs remaining, and ends with the total', () => {
    const message = formatOwedMessage({
      name: 'Mau',
      total: '200',
      openingOwed: '0',
      shares: [share('2026-09-21', 'Grab', '300', '200'), share('2026-09-20', 'Jollibee', '500', '0')],
      payments: [{ amount: '600', date: '2026-09-22' }],
    });
    const lines = message.split('\n');
    expect(lines[0]).toBe("Hi Mau! Here's a summary of what you owe me:");
    expect(message.indexOf('Jollibee')).toBeLessThan(message.indexOf('Grab'));
    expect(message).toContain('(paid)');
    expect(message).toContain('left)');
    expect(message).toContain('Payments received:');
    expect(lines[lines.length - 1]).toContain('Total owed:');
    expect(lines[lines.length - 1]).toContain('200.00');
  });

  it('includes a previous balance line only when there is one', () => {
    const withOpening = formatOwedMessage({ name: 'Jam', total: '500', openingOwed: '500', shares: [], payments: [] });
    expect(withOpening).toContain('Previous balance:');
    expect(withOpening).not.toContain('Shared expenses:');
    expect(withOpening).not.toContain('Payments received:');

    const without = formatOwedMessage({ name: 'Jam', total: '0', openingOwed: '0', shares: [], payments: [] });
    expect(without).not.toContain('Previous balance:');
  });

  it('falls back to the category when an expense has no merchant', () => {
    const message = formatOwedMessage({
      name: 'Aang',
      total: '100',
      openingOwed: '0',
      shares: [share('2026-09-20', null, '100', '100')],
      payments: [],
    });
    expect(message).toContain('Food:');
  });
});
