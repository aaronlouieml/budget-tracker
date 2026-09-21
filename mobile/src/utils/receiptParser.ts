// Turns raw OCR output from a receipt photo into a best-effort guess at the
// amount/merchant/date, with a confidence tier the UI uses to decide whether
// to show a "please double check this" banner. Deliberately has zero
// React Native/Expo/ML-Kit imports - it's pure string/regex logic over a
// plain shape, so it's trivially unit-testable (see receiptParser.test.ts)
// and stays decoupled from whichever OCR SDK produced the text.
//
// This is never trusted blindly: the caller (ExpenseFormScreen) always
// shows the result in an editable form the user must explicitly save.

export interface OcrBlock {
  text: string;
  frame: { x: number; y: number; width: number; height: number };
}

export interface OcrInput {
  text: string;
  blocks: OcrBlock[];
}

export type ReceiptConfidence = 'high' | 'low' | 'none';

export interface ParsedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  confidence: ReceiptConfidence;
}

// Strongest signal a line is THE final total, not a subtotal/tax/discount/
// change line on the way there.
const TOTAL_KEYWORDS_STRONG = ['grand total', 'total due', 'amount due', 'total amount'];
const TOTAL_KEYWORD_WEAK = 'total';

// Lines containing "total" that are actually something else - checked
// before the weak "total" keyword is allowed to match.
const AMOUNT_EXCLUSION_PATTERNS = [/sub\s*-?\s*total/i, /discount/i, /\bvat\b/i, /\btax\b/i, /\bchange\b/i, /cash\s*tendered/i, /\bqty\b/i];

// First complete money-shaped number in a string: thousands-comma-grouped
// (with optional cents), or a plain decimal, or a plain integer - in that
// preference order, since a comma-grouped or decimal match is more likely
// to be a real amount than a bare integer picked up by accident.
const MONEY_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+/;

function findMoneyInText(text: string): number | null {
  const match = text.match(MONEY_PATTERN);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractAmount(lines: string[]): { amount: number | null; matchedByKeyword: boolean } {
  for (const keyword of TOTAL_KEYWORDS_STRONG) {
    for (const line of lines) {
      const idx = line.toLowerCase().indexOf(keyword);
      if (idx === -1) continue;
      const amount = findMoneyInText(line.slice(idx + keyword.length));
      if (amount !== null) return { amount, matchedByKeyword: true };
    }
  }

  for (const line of lines) {
    if (AMOUNT_EXCLUSION_PATTERNS.some((p) => p.test(line))) continue;
    const idx = line.toLowerCase().indexOf(TOTAL_KEYWORD_WEAK);
    if (idx === -1) continue;
    const amount = findMoneyInText(line.slice(idx + TOTAL_KEYWORD_WEAK.length));
    if (amount !== null) return { amount, matchedByKeyword: true };
  }

  // No total-like line found at all - fall back to the largest money-shaped
  // number anywhere on the receipt, on the theory that the grand total is
  // usually the biggest single number (item amounts and tax/discount are
  // smaller parts of it). Explicitly a best guess, never "high" confidence.
  let largest: number | null = null;
  for (const line of lines) {
    const amount = findMoneyInText(line);
    if (amount !== null && (largest === null || amount > largest)) largest = amount;
  }
  return { amount: largest, matchedByKeyword: false };
}

const MERCHANT_EXCLUDE_PATTERNS = [
  /^official\s*receipt/i,
  /^receipt\b/i,
  /^invoice\b/i,
  /^or\s*#/i,
  /^or\s*no\b/i,
  /^tin\b/i,
  /^vat\s*reg/i,
  /^address\b/i,
  /^branch\b/i,
  /^cashier\b/i,
  /^store\s*#/i,
];
const PHONE_LIKE_PATTERN = /^\+?\d[\d\s\-()]{6,}$/;
// A leading street-number followed by a street-suffix/city word, e.g.
// "123 Rizal St, Makati City" - catches addresses that don't happen to
// start with a literal "Address:" label.
const ADDRESS_LIKE_PATTERN = /^\d+\s.*\b(st\.?|street|ave\.?|avenue|blvd\.?|boulevard|road|rd\.?|brgy\.?|barangay|city|drive|dr\.?)\b/i;

function isBoilerplateLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (PHONE_LIKE_PATTERN.test(trimmed)) return true;
  if (ADDRESS_LIKE_PATTERN.test(trimmed)) return true;
  return MERCHANT_EXCLUDE_PATTERNS.some((p) => p.test(trimmed));
}

function extractMerchant(input: OcrInput, lines: string[]): string | null {
  if (input.blocks.length > 0) {
    const topDown = [...input.blocks].sort((a, b) => a.frame.y - b.frame.y);
    for (const block of topDown.slice(0, 8)) {
      const text = block.text.trim();
      if (text && !isBoilerplateLine(text)) return text;
    }
    return null;
  }
  for (const line of lines) {
    if (!isBoilerplateLine(line)) return line;
  }
  return null;
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pivotYear(yy: number): number {
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isPlausibleDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return false;
  const candidate = new Date(y, m - 1, d);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return candidate <= tomorrow;
}

function extractDate(text: string): string | null {
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isPlausibleDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  // Slash-separated - ambiguous between MM/DD and DD/MM; default to
  // month-first (matches the rest of this app's date convention), but
  // flip when the first segment can only be a day (>12).
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y = pivotYear(y);
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      month = b;
      day = a;
    }
    if (isPlausibleDate(y, month, day)) return `${y}-${pad2(month)}-${pad2(day)}`;
  }

  m = text.match(/\b(\d{1,2})[-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s,]+(\d{2,4})\b/i);
  if (m) {
    const d = Number(m[1]);
    const mo = MONTH_NAMES.indexOf(m[2].toLowerCase()) + 1;
    let y = Number(m[3]);
    if (y < 100) y = pivotYear(y);
    if (isPlausibleDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{2,4})\b/i);
  if (m) {
    const mo = MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1;
    const d = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y = pivotYear(y);
    if (isPlausibleDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  return null;
}

export function parseReceipt(input: OcrInput): ParsedReceipt {
  const lines = input.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const { amount, matchedByKeyword } = extractAmount(lines);
  const merchant = extractMerchant(input, lines);
  const date = extractDate(input.text);

  const confidence: ReceiptConfidence = amount === null ? 'none' : matchedByKeyword ? 'high' : 'low';

  return { amount, merchant, date, confidence };
}
