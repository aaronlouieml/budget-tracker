import { recurringPaymentRepository, type RecurringFrequency, type RecurringPaymentRow } from '../repositories/recurringPaymentRepository';
import { creditCardRepository } from '../repositories/creditCardRepository';
import { toCents, fromCents } from '../utils/money';
import { expenseService } from './expenseService';
import { ServiceError } from './errors';

export interface RecurringPayment {
  id: string;
  credit_card_id: string;
  name: string;
  amount: string;
  frequency: RecurringFrequency;
  next_date: string;
  category: string | null;
  is_active: boolean;
  note: string | null;
}

export interface RecurringPaymentInput {
  creditCardId: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  nextDate: string;
  category?: string | null;
  note?: string | null;
}

function toRecurringPayment(row: RecurringPaymentRow): RecurringPayment {
  return {
    id: row.id,
    credit_card_id: row.credit_card_id,
    name: row.name,
    amount: fromCents(row.amount_cents),
    frequency: row.frequency,
    next_date: row.next_date,
    category: row.category,
    is_active: row.is_active === 1,
    note: row.note,
  };
}

function validate(input: RecurringPaymentInput) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  if (!input.amount || input.amount <= 0) errors.push('amount must be a positive number');
  if (!['weekly', 'monthly', 'yearly'].includes(input.frequency)) errors.push('frequency must be weekly, monthly, or yearly');
  if (!input.nextDate) errors.push('next date is required');
  if (errors.length > 0) throw new ServiceError(errors);
}

// Advances a date by one period of the given frequency - used after a
// recurring payment is recorded, so "next" always points forward.
export function advanceDate(dateISO: string, frequency: RecurringFrequency): string {
  const d = new Date(dateISO + 'T00:00:00');
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const recurringPaymentService = {
  async listForCard(cardId: string): Promise<RecurringPayment[]> {
    const rows = await recurringPaymentRepository.forCard(cardId);
    return rows.map(toRecurringPayment);
  },

  async listUpcoming(limit = 5): Promise<(RecurringPayment & { credit_card_name: string })[]> {
    const rows = await recurringPaymentRepository.listActive();
    return rows.slice(0, limit).map((r) => ({ ...toRecurringPayment(r), credit_card_name: r.credit_card_name }));
  },

  async create(input: RecurringPaymentInput): Promise<RecurringPayment> {
    validate(input);
    const card = await creditCardRepository.findById(input.creditCardId);
    if (!card) throw new ServiceError(['Credit card not found'], 404);
    const row = await recurringPaymentRepository.insert({
      creditCardId: input.creditCardId,
      name: input.name.trim(),
      amountCents: toCents(input.amount),
      frequency: input.frequency,
      nextDate: input.nextDate,
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
    });
    return toRecurringPayment(row);
  },

  async update(id: string, input: RecurringPaymentInput): Promise<RecurringPayment> {
    validate(input);
    const row = await recurringPaymentRepository.update(id, {
      name: input.name.trim(),
      amountCents: toCents(input.amount),
      frequency: input.frequency,
      nextDate: input.nextDate,
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
    });
    if (!row) throw new ServiceError(['Recurring payment not found'], 404);
    return toRecurringPayment(row);
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await recurringPaymentRepository.setActive(id, isActive);
  },

  async delete(id: string): Promise<void> {
    const deleted = await recurringPaymentRepository.delete(id);
    if (!deleted) throw new ServiceError(['Recurring payment not found'], 404);
  },

  // The only place a recurring payment definition turns into a real expense -
  // always explicit, user-confirmed, never automatic. Advances next_date by
  // one period afterward.
  async recordAsExpense(id: string, date: string): Promise<void> {
    const row = await recurringPaymentRepository.findById(id);
    if (!row) throw new ServiceError(['Recurring payment not found'], 404);
    await expenseService.createExpense({
      amount: Number(fromCents(row.amount_cents)),
      category: row.category || 'Bills',
      date,
      merchant: row.name,
      payment_method: 'credit_card',
      credit_card_id: row.credit_card_id,
      bank_account_id: null,
      receipt_image: null,
    });
    await recurringPaymentRepository.setNextDate(id, advanceDate(row.next_date, row.frequency));
  },
};
