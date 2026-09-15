import { getDb } from '../database/sqlite';
import { bankAccountRepository, type ReservationRow } from '../repositories/bankAccountRepository';
import { toCents, fromCents } from '../utils/money';
import { ServiceError } from './errors';

export type AccountType = 'savings' | 'checking' | 'cash' | 'ewallet';
export type ReservationPurpose = 'credit_card_payment' | 'bill' | 'other';
export type ReservationStatus = 'reserved' | 'fulfilled';

const ACCOUNT_TYPES: AccountType[] = ['savings', 'checking', 'cash', 'ewallet'];
const PURPOSES: ReservationPurpose[] = ['credit_card_payment', 'bill', 'other'];

export interface BankAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  created_at: string;
  updated_at: string;
  reserved: string;
  available: string;
}

export interface Reservation {
  id: string;
  bank_account_id: string;
  name: string;
  amount: string;
  purpose: ReservationPurpose;
  credit_card_id: string | null;
  credit_card_name: string | null;
  status: ReservationStatus;
  created_at: string;
}

export interface IncomingMoney {
  id: string;
  bank_account_id: string;
  amount: string;
  description: string | null;
  created_at: string;
}

export interface BankAccountDetail {
  account: BankAccount;
  reservations: Reservation[];
  incoming: IncomingMoney[];
  incomingTotal: string;
  potentialAvailable: string;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  balance: number;
}

export interface ReservationInput {
  name: string;
  amount: number;
  purpose: ReservationPurpose;
  creditCardId: string | null;
}

function validateAccountInput(input: AccountInput) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  if (!ACCOUNT_TYPES.includes(input.type)) errors.push(`type must be one of: ${ACCOUNT_TYPES.join(', ')}`);
  if (input.balance === undefined || input.balance === null || Number.isNaN(Number(input.balance))) {
    errors.push('balance must be numeric');
  }
  if (errors.length > 0) throw new ServiceError(errors);
}

function validateReservationInput(input: ReservationInput) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  if (!input.amount || Number.isNaN(Number(input.amount)) || input.amount <= 0) errors.push('amount must be a positive number');
  if (!PURPOSES.includes(input.purpose)) errors.push(`purpose must be one of: ${PURPOSES.join(', ')}`);
  if (errors.length > 0) throw new ServiceError(errors);
}

function toBankAccount(row: { id: string; name: string; type: string; balance_cents: number; created_at: string; updated_at: string }, reservedCents: number): BankAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    balance: fromCents(row.balance_cents),
    created_at: row.created_at,
    updated_at: row.updated_at,
    reserved: fromCents(reservedCents),
    available: fromCents(row.balance_cents - reservedCents),
  };
}

function toReservation(row: ReservationRow & { credit_card_name?: string | null }): Reservation {
  return {
    id: row.id,
    bank_account_id: row.bank_account_id,
    name: row.name,
    amount: fromCents(row.amount_cents),
    purpose: row.purpose as ReservationPurpose,
    credit_card_id: row.credit_card_id,
    credit_card_name: row.credit_card_name ?? null,
    status: row.status as ReservationStatus,
    created_at: row.created_at,
  };
}

export const bankAccountService = {
  async listAccounts(): Promise<BankAccount[]> {
    const [accounts, reservedTotals] = await Promise.all([
      bankAccountRepository.listAll(),
      bankAccountRepository.reservedTotalsByAccount(),
    ]);
    return accounts.map((a) => toBankAccount(a, reservedTotals.get(a.id) ?? 0));
  },

  async createAccount(input: AccountInput): Promise<BankAccount> {
    validateAccountInput(input);
    const row = await bankAccountRepository.insert({ name: input.name.trim(), type: input.type, balanceCents: toCents(input.balance) });
    return toBankAccount(row, 0);
  },

  async fetchAccount(id: string): Promise<BankAccountDetail> {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const [reservations, incoming] = await Promise.all([
      bankAccountRepository.reservationsForAccount(id),
      bankAccountRepository.incomingForAccount(id),
    ]);

    const reservedCents = reservations.filter((r) => r.status === 'reserved').reduce((sum, r) => sum + r.amount_cents, 0);
    const incomingTotalCents = incoming.reduce((sum, i) => sum + i.amount_cents, 0);
    const bankAccount = toBankAccount(account, reservedCents);

    return {
      account: bankAccount,
      reservations: reservations.map(toReservation),
      incoming: incoming.map((i) => ({ id: i.id, bank_account_id: i.bank_account_id, amount: fromCents(i.amount_cents), description: i.description, created_at: i.created_at })),
      incomingTotal: fromCents(incomingTotalCents),
      potentialAvailable: fromCents(account.balance_cents - reservedCents + incomingTotalCents),
    };
  },

  async updateAccount(id: string, input: AccountInput): Promise<BankAccount> {
    validateAccountInput(input);
    const row = await bankAccountRepository.update(id, { name: input.name.trim(), type: input.type, balanceCents: toCents(input.balance) });
    if (!row) throw new ServiceError(['Bank account not found'], 404);
    const reserved = await bankAccountRepository.reservedTotalForAccount(id);
    return toBankAccount(row, reserved);
  },

  async deleteAccount(id: string): Promise<void> {
    const deleted = await bankAccountRepository.delete(id);
    if (!deleted) throw new ServiceError(['Bank account not found'], 404);
  },

  async createReservation(accountId: string, input: ReservationInput): Promise<Reservation> {
    validateReservationInput(input);
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const db = await getDb();
    let created: ReservationRow | null = null;
    await db.withTransactionAsync(async () => {
      const existingReserved = await bankAccountRepository.reservedTotalForAccount(accountId);
      const availableForReservation = account.balance_cents - existingReserved;
      const amountCents = toCents(input.amount);
      if (amountCents > availableForReservation + 1) {
        throw new ServiceError([`Cannot reserve more than the available balance (${fromCents(availableForReservation)} available)`]);
      }
      created = await bankAccountRepository.insertReservation({
        bankAccountId: accountId,
        name: input.name.trim(),
        amountCents,
        purpose: input.purpose,
        creditCardId: input.purpose === 'credit_card_payment' ? input.creditCardId : null,
      });
    });
    return toReservation(created!);
  },

  async updateReservation(accountId: string, reservationId: string, input: ReservationInput): Promise<Reservation> {
    validateReservationInput(input);
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    const existing = await bankAccountRepository.findReservation(accountId, reservationId);
    if (!existing || existing.status !== 'reserved') throw new ServiceError(['Reservation not found'], 404);

    const db = await getDb();
    let updated: ReservationRow | null = null;
    await db.withTransactionAsync(async () => {
      const otherReserved = await bankAccountRepository.otherReservedTotal(accountId, reservationId);
      const availableForReservation = account.balance_cents - otherReserved;
      const amountCents = toCents(input.amount);
      if (amountCents > availableForReservation + 1) {
        throw new ServiceError([`Cannot reserve more than the available balance (${fromCents(availableForReservation)} available)`]);
      }
      updated = await bankAccountRepository.updateReservation(reservationId, {
        name: input.name.trim(),
        amountCents,
        purpose: input.purpose,
        creditCardId: input.purpose === 'credit_card_payment' ? input.creditCardId : null,
      });
    });
    return toReservation(updated!);
  },

  async deleteReservation(accountId: string, reservationId: string): Promise<void> {
    const deleted = await bankAccountRepository.deleteReservation(accountId, reservationId);
    if (!deleted) throw new ServiceError(['Reservation not found'], 404);
  },

  async createIncoming(accountId: string, input: { amount: number; description: string | null }): Promise<IncomingMoney> {
    if (!input.amount || Number.isNaN(Number(input.amount)) || input.amount <= 0) {
      throw new ServiceError(['amount must be a positive number']);
    }
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    const row = await bankAccountRepository.insertIncoming({
      bankAccountId: accountId,
      amountCents: toCents(input.amount),
      description: input.description?.trim() || null,
    });
    return { id: row.id, bank_account_id: row.bank_account_id, amount: fromCents(row.amount_cents), description: row.description, created_at: row.created_at };
  },

  async deleteIncoming(accountId: string, incomingId: string): Promise<void> {
    const deleted = await bankAccountRepository.deleteIncoming(accountId, incomingId);
    if (!deleted) throw new ServiceError(['Incoming money entry not found'], 404);
  },
};
