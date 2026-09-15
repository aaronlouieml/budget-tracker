import * as Crypto from 'expo-crypto';

// Money is stored in SQLite as integer cents to avoid floating-point drift;
// every repository converts to/at this boundary so the rest of the app keeps
// working with the same "1234.56" decimal strings the old API returned.
export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function newId(): string {
  return Crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}
