import { parseReceipt } from './receiptParser';

function textOnly(text: string) {
  return { text, blocks: [] };
}

describe('parseReceipt - amount detection', () => {
  it('picks the Total line on a clean receipt', () => {
    const result = parseReceipt(
      textOnly(
        [
          'Jollibee SM North EDSA',
          'Branch: SM North',
          'OR# 123456',
          '1 Chickenjoy      125.00',
          '1 Coke Float       55.00',
          'Subtotal          180.00',
          'VAT (12%)          21.60',
          'Total             201.60',
        ].join('\n')
      )
    );
    expect(result.amount).toBe(201.6);
    expect(result.confidence).toBe('high');
    expect(result.merchant).toContain('Jollibee');
  });

  it('prefers Grand Total over Subtotal/Discount/Cash Tendered/Change lines', () => {
    const result = parseReceipt(
      textOnly(
        [
          'SM Supermarket',
          'Subtotal        1,250.00',
          'Member Discount    50.00',
          'Grand Total     1,200.00',
          'Cash Tendered   1,500.00',
          'Change            300.00',
        ].join('\n')
      )
    );
    expect(result.amount).toBe(1200);
    expect(result.confidence).toBe('high');
  });

  it('handles a peso symbol with comma-grouped decimal amount', () => {
    const result = parseReceipt(textOnly(['Starbucks Ayala Triangle', 'Total Due: ₱2,499.75'].join('\n')));
    expect(result.amount).toBe(2499.75);
    expect(result.confidence).toBe('high');
  });

  it('falls back to a best guess on broken/angled OCR text with no clean total line', () => {
    const result = parseReceipt(
      textOnly(['M cD o n a l d s', '', '', '1 Big     Mac Meal', '     259 .00', 'thank you come again'].join('\n'))
    );
    expect(result.confidence).not.toBe('high');
    expect(result.amount).not.toBeNull();
  });

  it('reports no confidence when nothing usable is found', () => {
    const result = parseReceipt(textOnly('...\n---\n'));
    expect(result.amount).toBeNull();
    expect(result.confidence).toBe('none');
  });

  it('reports no confidence for a truly empty scan', () => {
    const result = parseReceipt(textOnly(''));
    expect(result.amount).toBeNull();
    expect(result.merchant).toBeNull();
    expect(result.confidence).toBe('none');
  });
});

describe('parseReceipt - merchant detection', () => {
  it('skips a leading "OFFICIAL RECEIPT" boilerplate line and picks the real name below it', () => {
    const result = parseReceipt(textOnly(['OFFICIAL RECEIPT', 'Mango Tree Cafe', 'Total 350.00'].join('\n')));
    expect(result.merchant).toBe('Mango Tree Cafe');
  });

  it('skips address/phone-shaped lines before the store name', () => {
    const result = parseReceipt(textOnly(['123 Rizal St, Makati City', '+63 917 123 4567', 'Ministop Legaspi', 'Total 99.00'].join('\n')));
    expect(result.merchant).toBe('Ministop Legaspi');
  });
});

describe('parseReceipt - date detection', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseReceipt(textOnly('Date: 2026-03-05\nTotal 100.00')).date).toBe('2026-03-05');
  });

  it('parses MM/DD/YYYY (month-first default)', () => {
    expect(parseReceipt(textOnly('03/05/2026\nTotal 100.00')).date).toBe('2026-03-05');
  });

  it('flips to DD/MM when the first segment cannot be a month', () => {
    expect(parseReceipt(textOnly('25/12/2025\nTotal 100.00')).date).toBe('2025-12-25');
  });

  it('parses a word-month date like "Mar 5, 2026"', () => {
    expect(parseReceipt(textOnly('Mar 5, 2026\nTotal 100.00')).date).toBe('2026-03-05');
  });

  it('returns null when no plausible date is present', () => {
    expect(parseReceipt(textOnly('Total 100.00')).date).toBeNull();
  });
});
