import { getDb } from '../database/sqlite';
import { savedPlanRepository, type SavedPlanRow } from '../repositories/savedPlanRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { toCents, fromCents } from '../utils/money';
import { ServiceError } from './errors';

export interface PlanAllocation {
  id: string;
  name: string;
  amount: string;
}

export interface SavedPlan {
  id: string;
  name: string;
  expected_date: string | null;
  planned_amount: string | null;
  note: string | null;
  used_at: string | null;
  created_at: string;
  allocations: PlanAllocation[];
  allocationsTotal: string;
}

export interface SavedPlanInput {
  name: string;
  expectedDate: string | null;
  plannedAmount: number | null;
  note: string | null;
  allocations: { name: string; amount: number }[];
}

async function toSavedPlan(row: SavedPlanRow): Promise<SavedPlan> {
  const allocationRows = await savedPlanRepository.allocationsForPlan(row.id);
  return {
    id: row.id,
    name: row.name,
    expected_date: row.expected_date,
    planned_amount: row.planned_amount_cents != null ? fromCents(row.planned_amount_cents) : null,
    note: row.note,
    used_at: row.used_at,
    created_at: row.created_at,
    allocations: allocationRows.map((a) => ({ id: a.id, name: a.name, amount: fromCents(a.amount_cents) })),
    allocationsTotal: fromCents(allocationRows.reduce((sum, a) => sum + a.amount_cents, 0)),
  };
}

function validate(input: SavedPlanInput) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  for (const a of input.allocations) {
    if (!a.name?.trim()) errors.push('each allocation needs a name');
    if (!a.amount || a.amount <= 0) errors.push('each allocation amount must be a positive number');
  }
  if (errors.length > 0) throw new ServiceError(errors);
}

export const savedPlanService = {
  async listPlans(): Promise<SavedPlan[]> {
    const rows = await savedPlanRepository.listAll();
    return Promise.all(rows.map(toSavedPlan));
  },

  async fetchPlan(id: string): Promise<SavedPlan> {
    const row = await savedPlanRepository.findById(id);
    if (!row) throw new ServiceError(['Plan not found'], 404);
    return toSavedPlan(row);
  },

  // Purely bookkeeping - does NOT touch any account balance, reservation, or
  // expense. It's a plan for money that hasn't arrived yet.
  async createPlan(input: SavedPlanInput): Promise<SavedPlan> {
    validate(input);
    const row = await savedPlanRepository.insert({
      name: input.name.trim(),
      expectedDate: input.expectedDate,
      plannedAmountCents: input.plannedAmount != null ? toCents(input.plannedAmount) : null,
      note: input.note?.trim() || null,
      allocations: input.allocations.map((a) => ({ name: a.name.trim(), amountCents: toCents(a.amount) })),
    });
    return toSavedPlan(row);
  },

  async deletePlan(id: string): Promise<void> {
    const deleted = await savedPlanRepository.delete(id);
    if (!deleted) throw new ServiceError(['Plan not found'], 404);
  },

  // The only place a plan's allocations become real: increases the account's
  // actual current balance by the received amount, and turns each allocation
  // into a real reservation. The plan itself is left intact (just marked
  // used) so it can be reused for a future occurrence.
  async importPlan(planId: string, input: { accountId: string; amount: number; date: string }): Promise<void> {
    if (!input.amount || input.amount <= 0) throw new ServiceError(['amount must be a positive number']);
    const plan = await savedPlanRepository.findById(planId);
    if (!plan) throw new ServiceError(['Plan not found'], 404);
    const account = await bankAccountRepository.findById(input.accountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    const allocations = await savedPlanRepository.allocationsForPlan(planId);

    const allocationsTotalCents = allocations.reduce((sum, a) => sum + a.amount_cents, 0);
    const amountCents = toCents(input.amount);
    if (allocationsTotalCents > amountCents + 1) {
      throw new ServiceError([`Allocations (${fromCents(allocationsTotalCents)}) exceed the incoming amount (${fromCents(amountCents)})`]);
    }

    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await bankAccountRepository.adjustBalance(input.accountId, amountCents);
      await savedPlanRepository.insertImport({ planId, bankAccountId: input.accountId, amountCents, date: input.date });
      for (const allocation of allocations) {
        await bankAccountRepository.insertReservation({
          bankAccountId: input.accountId,
          name: allocation.name,
          amountCents: allocation.amount_cents,
          purpose: 'other',
          creditCardId: null,
        });
      }
      await savedPlanRepository.markUsed(planId);
    });
  },
};
