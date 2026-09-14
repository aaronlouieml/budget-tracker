import type { ExtractedReceipt } from './types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function toISODate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = year < 100 ? 2000 + year : year;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function extractDate(text: string): string | null {
  // "September 14, 2026" or "Sep 14 2026"
  const monthNameMatch = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (monthNameMatch) {
    const month = MONTHS[monthNameMatch[1].toLowerCase()];
    return toISODate(Number(monthNameMatch[3]), month, Number(monthNameMatch[2]));
  }

  // "14 September 2026"
  const dayFirstMatch = text.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+(\d{4})\b/i
  );
  if (dayFirstMatch) {
    const month = MONTHS[dayFirstMatch[2].toLowerCase()];
    return toISODate(Number(dayFirstMatch[3]), month, Number(dayFirstMatch[1]));
  }

  // ISO: 2026-09-14
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return toISODate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // 09/14/2026 (assumes MM/DD/YYYY, the common POS receipt format)
  const slashMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slashMatch) {
    return toISODate(Number(slashMatch[3]), Number(slashMatch[1]), Number(slashMatch[2]));
  }

  return null;
}

export function extractAmount(text: string): number | null {
  const lines = text.split('\n');

  // Prefer a line that explicitly says TOTAL (but not "SUBTOTAL").
  for (const line of lines) {
    if (/\btotal\b/i.test(line) && !/sub\s*-?total/i.test(line)) {
      const value = lastNumberOnLine(line);
      if (value !== null) return value;
    }
  }

  // Fall back to the largest currency-looking number anywhere in the receipt
  // (the grand total is usually the biggest line item).
  const matches = [...text.matchAll(/(?:₱|php|p)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi)];
  const values = matches
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (values.length === 0) return null;
  return Math.max(...values);
}

function lastNumberOnLine(line: string): number | null {
  const matches = [...line.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g)];
  if (matches.length === 0) return null;
  const value = Number(matches[matches.length - 1][1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export function extractMerchant(text: string): string | null {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 1 && /[a-z]/i.test(line));

  if (!firstLine) return null;
  return toTitleCase(firstLine);
}

// Capitalizes each word, but keeps short all-caps tokens (e.g. "SM") as-is
// since they're usually abbreviations rather than shouted words.
function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function extractReceiptFields(rawText: string): ExtractedReceipt {
  return {
    amount: extractAmount(rawText),
    date: extractDate(rawText),
    merchant: extractMerchant(rawText),
  };
}
