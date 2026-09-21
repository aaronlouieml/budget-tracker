import { getDb } from '../database/sqlite';
import { bankAccountRepository, type ReservationRow } from '../repositories/bankAccountRepository';
import { expenseRepository } from '../repositories/expenseRepository';
import { creditCardRepository } from '../repositories/creditCardRepository';
import { personRepository } from '../repositories/personRepository';
import { transferRepository } from '../repositories/transferRepository';
import { savedPlanRepository } from '../repositories/savedPlanRepository';
import { toCents, fromCents } from '../utils/money';
import { ServiceError } from './errors';

export type AccountType = 'savings' | 'checking' | 'cash' | 'ewallet';
export type ReservationPurpose = 'credit_card_payment' | 'bill' | 'other';
export type ReservationStatus = 'reserved' | 'fulfilled';
export type IncomingStatus = 'pending' | 'received';
export type IncomingSourceType = 'manual' | 'salary' | 'refund' | 'gift' | 'other';

const ACCOUNT_TYPES: AccountType[] = ['savings', 'checking', 'cash', 'ewallet'];
const PURPOSES: ReservationPurpose[] = ['credit_card_payment', 'bill', 'other'];
const SOURCE_TYPES: IncomingSourceType[] = ['manual', 'salary', 'refund', 'gift', 'other'];

export interface BankAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: string;
  created_at: string;
  updated_at: string;
  reserved: string;
  available: string;
  myResponsibility: string;
  othersOwe: string;
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
  category: string | null;
  planned_date: string | null;
  created_at: string;
}

export interface IncomingMoney {
  id: string;
  bank_account_id: string;
  amount: string;
  description: string | null;
  status: IncomingStatus;
  received_at: string | null;
  source_type: IncomingSourceType;
  created_at: string;
}

export interface BankAccountDetail {
  account: BankAccount;
  reservations: Reservation[];
  incoming: IncomingMoney[];
  incomingTotal: string;
  potentialAvailable: string;
}

export type ActivityType = 'expense' | 'credit_card_payment' | 'transfer' | 'incoming' | 'reimbursement' | 'plan_import' | 'set_aside_used';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  label: string;
  detail: string | null;
  amount: string;
  // 'none' = no money moved (e.g. a set-aside marked as used).
  direction: 'in' | 'out' | 'none';
  date: string;
  created_at: string;
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
  category: string | null;
  plannedDate: string | null;
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

function toBankAccount(
  row: { id: string; name: string; type: string; balance_cents: number; created_at: string; updated_at: string },
  reservedCents: number,
  responsibility: { myResponsibilityCents: number; othersOweCents: number } = { myResponsibilityCents: 0, othersOweCents: 0 }
): BankAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    balance: fromCents(row.balance_cents),
    created_at: row.created_at,
    updated_at: row.updated_at,
    reserved: fromCents(reservedCents),
    available: fromCents(row.balance_cents - reservedCents),
    myResponsibility: fromCents(responsibility.myResponsibilityCents),
    othersOwe: fromCents(responsibility.othersOweCents),
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
    category: row.category,
    planned_date: row.planned_date,
    created_at: row.created_at,
  };
}

function toIncoming(row: {
  id: string;
  bank_account_id: string;
  amount_cents: number;
  description: string | null;
  status: string;
  received_at: string | null;
  source_type: string;
  created_at: string;
}): IncomingMoney {
  return {
    id: row.id,
    bank_account_id: row.bank_account_id,
    amount: fromCents(row.amount_cents),
    description: row.description,
    status: row.status as IncomingStatus,
    received_at: row.received_at,
    source_type: row.source_type as IncomingSourceType,
    created_at: row.created_at,
  };
}

export const bankAccountService = {
  async listAccounts(): Promise<BankAccount[]> {
    const [accounts, reservedTotals] = await Promise.all([
      bankAccountRepository.listAll(),
      bankAccountRepository.reservedTotalsByAccount(),
    ]);
    const responsibilities = await Promise.all(accounts.map((a) => bankAccountRepository.responsibilityTotals(a.id)));
    return accounts.map((a, i) => toBankAccount(a, reservedTotals.get(a.id) ?? 0, responsibilities[i]));
  },

  async createAccount(input: AccountInput): Promise<BankAccount> {
    validateAccountInput(input);
    const row = await bankAccountRepository.insert({ name: input.name.trim(), type: input.type, balanceCents: toCents(input.balance) });
    return toBankAccount(row, 0);
  },

  async fetchAccount(id: string): Promise<BankAccountDetail> {
    const account = await bankAccountRepository.findById(id);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const [reservations, incoming, responsibility] = await Promise.all([
      bankAccountRepository.reservationsForAccount(id),
      bankAccountRepository.incomingForAccount(id),
      bankAccountRepository.responsibilityTotals(id),
    ]);

    const reservedCents = reservations.filter((r) => r.status === 'reserved').reduce((sum, r) => sum + r.amount_cents, 0);
    // Only PENDING incoming money is "not yet real" - received rows are
    // already inside balance_cents, so summing them here too would double
    // count (see confirmIncoming/createDeposit, which credit the balance).
    const pendingIncoming = incoming.filter((i) => i.status === 'pending');
    const incomingTotalCents = pendingIncoming.reduce((sum, i) => sum + i.amount_cents, 0);
    const bankAccount = toBankAccount(account, reservedCents, responsibility);

    return {
      account: bankAccount,
      reservations: reservations.map(toReservation),
      incoming: incoming.map(toIncoming),
      incomingTotal: fromCents(incomingTotalCents),
      potentialAvailable: fromCents(account.balance_cents - reservedCents + incomingTotalCents),
    };
  },

  // "Why did my balance change?" - merges every source of real money movement
  // for this account. Creating a reservation doesn't move money, so it isn't
  // listed; only a set-aside later marked as used is (see below).
  async getActivity(accountId: string): Promise<ActivityItem[]> {
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const [expenses, payments, incoming, reimbursements, transfers, planImports, reservations] = await Promise.all([
      expenseRepository.forAccount(accountId),
      creditCardRepository.paymentsForAccount(accountId),
      bankAccountRepository.incomingForAccount(accountId),
      personRepository.paymentsForAccount(accountId),
      transferRepository.forAccount(accountId),
      savedPlanRepository.importsForAccount(accountId),
      bankAccountRepository.reservationsForAccount(accountId),
    ]);

    const items: ActivityItem[] = [
      ...expenses.map((e) => ({
        id: e.id,
        type: 'expense' as const,
        label: e.category,
        detail: e.merchant,
        amount: fromCents(e.amount_cents),
        direction: 'out' as const,
        date: e.date,
        created_at: e.created_at,
      })),
      ...payments.map((p) => ({
        id: p.id,
        type: 'credit_card_payment' as const,
        label: 'Credit Card Payment',
        detail: p.credit_card_name,
        amount: fromCents(p.amount_cents),
        direction: 'out' as const,
        date: p.date,
        created_at: p.created_at,
      })),
      ...incoming
        .filter((i) => i.status === 'received')
        .map((i) => ({
          id: i.id,
          type: 'incoming' as const,
          label: 'Incoming Money',
          detail: i.description,
          amount: fromCents(i.amount_cents),
          direction: 'in' as const,
          date: (i.received_at ?? i.created_at).slice(0, 10),
          created_at: i.created_at,
        })),
      ...reimbursements.map((r) => ({
        id: r.id,
        type: 'reimbursement' as const,
        label: `${r.person_name} Reimbursement`,
        detail: null,
        amount: fromCents(r.amount_cents),
        direction: 'in' as const,
        date: r.date,
        created_at: r.created_at,
      })),
      ...transfers.map((t) => ({
        id: t.id,
        type: 'transfer' as const,
        label: t.from_account_id === accountId ? `Transfer to ${t.to_account_name}` : `Transfer from ${t.from_account_name}`,
        detail: t.note,
        amount: fromCents(t.amount_cents),
        direction: (t.from_account_id === accountId ? 'out' : 'in') as 'out' | 'in',
        date: t.date,
        created_at: t.created_at,
      })),
      // A set-aside the user marked as used: no money moved (balance is
      // unchanged), so it's listed without a direction. Ones consumed by a
      // payment/expense are skipped - that payment already has its own row.
      ...reservations
        .filter((r) => r.status === 'fulfilled' && r.fulfilled_via === 'release' && r.fulfilled_at)
        .map((r) => ({
          id: r.id,
          type: 'set_aside_used' as const,
          label: r.name,
          detail: 'Set aside used',
          amount: fromCents(r.amount_cents),
          direction: 'none' as const,
          date: r.fulfilled_at!.slice(0, 10),
          created_at: r.fulfilled_at!,
        })),
      ...planImports.map((p) => ({
        id: p.id,
        type: 'plan_import' as const,
        label: p.plan_name,
        detail: 'Plan imported',
        amount: fromCents(p.amount_cents),
        direction: 'in' as const,
        date: p.date,
        created_at: p.created_at,
      })),
    ];

    return items.sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)));
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
    if (account.balance_cents < 0) throw new ServiceError(['Cannot set money aside from a negative balance']);

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
        category: input.category?.trim() || null,
        plannedDate: input.plannedDate,
      });
    });
    return toReservation(created!);
  },

  async updateReservation(accountId: string, reservationId: string, input: ReservationInput): Promise<Reservation> {
    validateReservationInput(input);
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    if (account.balance_cents < 0) throw new ServiceError(['Cannot set money aside from a negative balance']);
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
        category: input.category?.trim() || null,
        plannedDate: input.plannedDate,
      });
    });
    return toReservation(updated!);
  },

  async deleteReservation(accountId: string, reservationId: string): Promise<void> {
    const deleted = await bankAccountRepository.deleteReservation(accountId, reservationId);
    if (!deleted) throw new ServiceError(['Reservation not found'], 404);
  },

  // Releases a Set Aside amount back to available money without touching
  // balance_cents - the money was already counted in the balance the whole
  // time; this only stops it being subtracted as "reserved". Full release
  // only (matches how a full credit-card payment already fulfills a
  // reservation via payFromAccount).
  async releaseReservation(accountId: string, reservationId: string): Promise<Reservation> {
    const existing = await bankAccountRepository.findReservation(accountId, reservationId);
    if (!existing || existing.status !== 'reserved') throw new ServiceError(['Reservation not found'], 404);
    await bankAccountRepository.markReservationReleased(reservationId);
    const updated = await bankAccountRepository.findReservation(accountId, reservationId);
    return toReservation(updated!);
  },

  async createIncoming(accountId: string, input: { amount: number; description: string | null; sourceType?: IncomingSourceType }): Promise<IncomingMoney> {
    if (!input.amount || Number.isNaN(Number(input.amount)) || input.amount <= 0) {
      throw new ServiceError(['amount must be a positive number']);
    }
    if (input.sourceType && !SOURCE_TYPES.includes(input.sourceType)) {
      throw new ServiceError([`sourceType must be one of: ${SOURCE_TYPES.join(', ')}`]);
    }
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    const row = await bankAccountRepository.insertIncoming({
      bankAccountId: accountId,
      amountCents: toCents(input.amount),
      description: input.description?.trim() || null,
      sourceType: input.sourceType,
    });
    return toIncoming(row);
  },

  async deleteIncoming(accountId: string, incomingId: string): Promise<void> {
    const deleted = await bankAccountRepository.deleteIncoming(accountId, incomingId);
    if (!deleted) throw new ServiceError(['Incoming money entry not found'], 404);
  },

  // Transitions a pending "Coming In" entry to received, crediting the
  // account's real balance in the same transaction it flips status - see
  // fetchAccount/getActivity above for why pending vs received matters.
  async confirmIncoming(accountId: string, incomingId: string): Promise<IncomingMoney> {
    const existing = await bankAccountRepository.findIncoming(accountId, incomingId);
    if (!existing || existing.status !== 'pending') throw new ServiceError(['Incoming money entry not found'], 404);

    const db = await getDb();
    let updated: Awaited<ReturnType<typeof bankAccountRepository.confirmIncoming>> = null;
    await db.withTransactionAsync(async () => {
      updated = await bankAccountRepository.confirmIncoming(accountId, incomingId);
      await bankAccountRepository.adjustBalance(accountId, existing.amount_cents);
    });
    return toIncoming(updated!);
  },

  // A manual deposit that's real the instant it's recorded (e.g. cash in
  // hand, a gift) - unlike createIncoming, which starts 'pending' and needs
  // confirmIncoming later. Never touches expenses.
  async createDeposit(accountId: string, input: { amount: number; description: string | null; sourceType: IncomingSourceType }): Promise<IncomingMoney> {
    if (!input.amount || Number.isNaN(Number(input.amount)) || input.amount <= 0) {
      throw new ServiceError(['amount must be a positive number']);
    }
    if (!SOURCE_TYPES.includes(input.sourceType)) {
      throw new ServiceError([`sourceType must be one of: ${SOURCE_TYPES.join(', ')}`]);
    }
    const account = await bankAccountRepository.findById(accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const amountCents = toCents(input.amount);
    const db = await getDb();
    let created: Awaited<ReturnType<typeof bankAccountRepository.insertDeposit>> | null = null;
    await db.withTransactionAsync(async () => {
      created = await bankAccountRepository.insertDeposit({
        bankAccountId: accountId,
        amountCents,
        description: input.description?.trim() || null,
        sourceType: input.sourceType,
      });
      await bankAccountRepository.adjustBalance(accountId, amountCents);
    });
    return toIncoming(created!);
  },
};
