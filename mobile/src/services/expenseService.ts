import { getDb } from '../database/sqlite';
import { expenseRepository, type ExpenseRow } from '../repositories/expenseRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { personRepository } from '../repositories/personRepository';
import { toCents, fromCents } from '../utils/money';
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
    if (input.bank_account_id && !(await bankAccountRepository.findById(input.bank_account_id))) {
      throw new ServiceError(['bank_account_id does not refer to a valid account']);
    }

    const db = await getDb();
    let created: ExpenseRow | null = null;
    await db.withTransactionAsync(async () => {
      created = await expenseRepository.insert({
        amountCents: toCents(input.amount),
        category: input.category.trim(),
        date: input.date,
        merchant: input.merchant,
        paymentMethod: input.payment_method,
        creditCardId: input.credit_card_id,
        bankAccountId: input.bank_account_id,
        receiptImage: input.receipt_image,
      });
      if (input.bank_account_id) {
        await bankAccountRepository.adjustBalance(input.bank_account_id, -toCents(input.amount));
      }
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
    if (input.bank_account_id && !(await bankAccountRepository.findById(input.bank_account_id))) {
      throw new ServiceError(['bank_account_id does not refer to a valid account']);
    }

    const db = await getDb();
    let updated: ExpenseRow | null = null;
    await db.withTransactionAsync(async () => {
      // Reverse the old effect on whichever account it used to debit.
      if (existing.bank_account_id && existing.bank_account_id !== input.bank_account_id) {
        await bankAccountRepository.adjustBalance(existing.bank_account_id, existing.amount_cents);
      }
      // Apply the (possibly new or re-amounted) expense's effect.
      const newAmountCents = toCents(input.amount);
      if (input.bank_account_id) {
        if (existing.bank_account_id === input.bank_account_id) {
          await bankAccountRepository.adjustBalance(input.bank_account_id, existing.amount_cents - newAmountCents);
        } else {
          await bankAccountRepository.adjustBalance(input.bank_account_id, -newAmountCents);
        }
      }

      updated = await expenseRepository.update(id, {
        amountCents: newAmountCents,
        category: input.category.trim(),
        date: input.date,
        merchant: input.merchant,
        paymentMethod: input.payment_method,
        creditCardId: input.credit_card_id,
        bankAccountId: input.bank_account_id,
        receiptImage: input.receipt_image,
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
      if (existing.bank_account_id) {
        await bankAccountRepository.adjustBalance(existing.bank_account_id, existing.amount_cents);
      }
      // expense_shares cascade-delete via FK (ON DELETE CASCADE + PRAGMA foreign_keys = ON).
      await expenseRepository.delete(id);
    });
  },
};
