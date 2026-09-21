import { getDb } from '../database/sqlite';
import { expenseRepository, type ExpenseRow } from '../repositories/expenseRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { personRepository } from '../repositories/personRepository';
import { toCents, fromCents } from '../utils/money';
import { calculateAvailable } from './financialMath';
import { ServiceError } from './errors';

export interface Expense {
  id: string;
  amount: string;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: string | null;
  bank_account_id: string | null;
  receipt_image: string | null;
  source: 'manual' | 'scan';
  reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseShareInput {
  personId: string;
  amount: number;
}

export interface ExpenseShareDetail {
  id: string;
  person_id: string;
  amount: string;
  person_name: string;
}

export interface ExpenseDetail extends Expense {
  shares: ExpenseShareDetail[];
  myShare: string;
}

export interface ExpenseInput {
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: string | null;
  bank_account_id: string | null;
  receipt_image: string | null;
  source: 'manual' | 'scan';
  // Pay from this set-aside (must belong to bank_account_id) instead of the
  // account's available money.
  reservation_id?: string | null;
  shares?: ExpenseShareInput[];
}

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amount: fromCents(row.amount_cents),
    category: row.category,
    date: row.date,
    merchant: row.merchant,
    payment_method: row.payment_method,
    credit_card_id: row.credit_card_id,
    bank_account_id: row.bank_account_id,
    receipt_image: row.receipt_image,
    source: row.source as 'manual' | 'scan',
    reservation_id: row.reservation_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateInput(input: ExpenseInput) {
  const errors: string[] = [];
  if (!input.amount || Number.isNaN(Number(input.amount))) errors.push('amount must be numeric');
  if (!input.category?.trim()) errors.push('category is required');
  if (!input.date) errors.push('date is required');
  if (input.credit_card_id && input.bank_account_id) errors.push('an expense cannot have both a credit card and a bank account');
  if (input.reservation_id && !input.bank_account_id) errors.push('a set-aside can only be used with a bank account');
  if (errors.length > 0) throw new ServiceError(errors);
}

async function validateShares(shares: ExpenseShareInput[] | undefined, expenseAmount: number): Promise<{ personId: string; amountCents: number }[]> {
  if (!shares || shares.length === 0) return [];
  const errors: string[] = [];
  const result: { personId: string; amountCents: number }[] = [];
  let totalCents = 0;

  for (const share of shares) {
    if (!share.personId) {
      errors.push('each share requires a valid personId');
      continue;
    }
    if (!share.amount || Number.isNaN(Number(share.amount)) || share.amount <= 0) {
      errors.push('each share amount must be a positive number');
      continue;
    }
    if (!(await personRepository.exists(share.personId))) {
      errors.push('one or more people in the split do not exist');
      continue;
    }
    const amountCents = toCents(share.amount);
    result.push({ personId: share.personId, amountCents });
    totalCents += amountCents;
  }

  if (errors.length === 0 && totalCents > toCents(expenseAmount) + 1) {
    errors.push(`Split shares (${fromCents(totalCents)}) cannot exceed the expense total (${fromCents(toCents(expenseAmount))})`);
  }
  if (errors.length > 0) throw new ServiceError(errors);
  return result;
}

// Takes the money for an expense out of a bank account: either from a
// specific set-aside (reducing/fulfilling it) or from the account's available
// money (which can't exceed balance minus what's set aside). Must run inside
// a transaction. Returns how much of the set-aside was consumed (null when
// paid from available money) so it can be restored if the expense changes.
async function fundFromAccount(accountId: string, amountCents: number, reservationId: string | null): Promise<number | null> {
  if (reservationId) {
    const reservation = await bankAccountRepository.findReservation(accountId, reservationId);
    if (!reservation || reservation.status !== 'reserved') throw new ServiceError(['That set-aside is no longer available']);
    if (amountCents > reservation.amount_cents + 1) {
      throw new ServiceError([`Amount exceeds the set-aside (${fromCents(reservation.amount_cents)} left)`]);
    }
    await bankAccountRepository.adjustBalance(accountId, -amountCents);
    const remaining = reservation.amount_cents - amountCents;
    if (remaining <= 1) {
      await bankAccountRepository.setReservationAmount(reservation.id, 0, 'fulfilled', 'payment');
      return reservation.amount_cents;
    }
    await bankAccountRepository.setReservationAmount(reservation.id, remaining, 'reserved');
    return amountCents;
  }

  const account = await bankAccountRepository.findById(accountId);
  if (!account) throw new ServiceError(['bank_account_id does not refer to a valid account']);
  const reservedCents = await bankAccountRepository.reservedTotalForAccount(accountId);
  const availableCents = calculateAvailable(account.balance_cents, reservedCents);
  if (amountCents > availableCents + 1) {
    throw new ServiceError([`Only ${fromCents(Math.max(0, availableCents))} available. Pick a set-aside to pay from, or lower the amount.`]);
  }
  await bankAccountRepository.adjustBalance(accountId, -amountCents);
  return null;
}

// Undoes fundFromAccount for an existing expense: refunds the account and
// gives back any set-aside it consumed. A set-aside the user has since
// marked as used (or deleted) is left alone - only the refund applies.
async function reverseFunding(row: ExpenseRow): Promise<void> {
  if (!row.bank_account_id) return;
  await bankAccountRepository.adjustBalance(row.bank_account_id, row.amount_cents);
  if (!row.reservation_id || !row.reservation_used_cents) return;
  const reservation = await bankAccountRepository.findReservationById(row.reservation_id);
  if (!reservation) return;
  if (reservation.status === 'reserved') {
    await bankAccountRepository.setReservationAmount(reservation.id, reservation.amount_cents + row.reservation_used_cents, 'reserved');
  } else if (reservation.fulfilled_via === 'payment') {
    await bankAccountRepository.setReservationAmount(reservation.id, row.reservation_used_cents, 'reserved');
  }
}

export const expenseService = {
  async listExpenses(): Promise<Expense[]> {
    const rows = await expenseRepository.listAll();
    return rows.map(toExpense);
  },

  async recentExpenses(limit: number): Promise<Expense[]> {
    const rows = await expenseRepository.recent(limit);
    return rows.map(toExpense);
  },

  async fetchExpense(id: string): Promise<ExpenseDetail> {
    const row = await expenseRepository.findById(id);
    if (!row) throw new ServiceError(['Expense not found'], 404);
    const shares = await expenseRepository.sharesForExpense(id);
    const sharesTotalCents = shares.reduce((sum, s) => sum + s.amount_cents, 0);
    return {
      ...toExpense(row),
      shares: shares.map((s) => ({ id: s.id, person_id: s.person_id, amount: fromCents(s.amount_cents), person_name: s.person_name })),
      myShare: fromCents(row.amount_cents - sharesTotalCents),
    };
  },

  async createExpense(input: ExpenseInput): Promise<Expense> {
    validateInput(input);
    const shares = await validateShares(input.shares, input.amount);
    if (input.bank_account_id) {
      const payingAccount = await bankAccountRepository.findById(input.bank_account_id);
      if (!payingAccount) throw new ServiceError(['bank_account_id does not refer to a valid account']);
      if (payingAccount.balance_cents < 0) throw new ServiceError(['Cannot charge an expense to a negative-balance account']);
    }

    const db = await getDb();
    let created: ExpenseRow | null = null;
    await db.withTransactionAsync(async () => {
      const amountCents = toCents(input.amount);
      const usedCents = input.bank_account_id ? await fundFromAccount(input.bank_account_id, amountCents, input.reservation_id ?? null) : null;
      created = await expenseRepository.insert({
        amountCents,
        category: input.category.trim(),
        date: input.date,
        merchant: input.merchant,
        paymentMethod: input.payment_method,
        creditCardId: input.credit_card_id,
        bankAccountId: input.bank_account_id,
        receiptImage: input.receipt_image,
        source: input.source,
        reservationId: usedCents !== null ? input.reservation_id ?? null : null,
        reservationUsedCents: usedCents,
      });
      if (shares.length > 0) {
        await expenseRepository.replaceShares(created.id, shares);
      }
    });
    return toExpense(created!);
  },

  async updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
    validateInput(input);
    const existing = await expenseRepository.findById(id);
    if (!existing) throw new ServiceError(['Expense not found'], 404);
    const shares = await validateShares(input.shares, input.amount);
    if (input.bank_account_id) {
      const payingAccount = await bankAccountRepository.findById(input.bank_account_id);
      if (!payingAccount) throw new ServiceError(['bank_account_id does not refer to a valid account']);
      if (payingAccount.balance_cents < 0) throw new ServiceError(['Cannot charge an expense to a negative-balance account']);
    }

    const db = await getDb();
    let updated: ExpenseRow | null = null;
    await db.withTransactionAsync(async () => {
      // Undo the old expense's effect first (refund + give back any set-aside
      // it used), then apply the new one - so the available/set-aside checks
      // see the state as if this expense hadn't happened yet.
      await reverseFunding(existing);
      const newAmountCents = toCents(input.amount);
      const usedCents = input.bank_account_id ? await fundFromAccount(input.bank_account_id, newAmountCents, input.reservation_id ?? null) : null;

      updated = await expenseRepository.update(id, {
        amountCents: newAmountCents,
        category: input.category.trim(),
        date: input.date,
        merchant: input.merchant,
        paymentMethod: input.payment_method,
        creditCardId: input.credit_card_id,
        bankAccountId: input.bank_account_id,
        receiptImage: input.receipt_image,
        source: input.source,
        reservationId: usedCents !== null ? input.reservation_id ?? null : null,
        reservationUsedCents: usedCents,
      });
      await expenseRepository.replaceShares(id, shares);
    });
    return toExpense(updated!);
  },

  async deleteExpense(id: string): Promise<void> {
    const existing = await expenseRepository.findById(id);
    if (!existing) throw new ServiceError(['Expense not found'], 404);

    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await reverseFunding(existing);
      // expense_shares cascade-delete via FK (ON DELETE CASCADE + PRAGMA foreign_keys = ON).
      await expenseRepository.delete(id);
    });
  },
};
