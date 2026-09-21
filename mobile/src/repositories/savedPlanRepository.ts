import { getDb } from '../database/sqlite';
import { newId, nowISO } from '../utils/money';

export interface SavedPlanRow {
  id: string;
  name: string;
  expected_date: string | null;
  planned_amount_cents: number | null;
  note: string | null;
  used_at: string | null;
  created_at: string;
}

export interface SavedPlanAllocationRow {
  id: string;
  plan_id: string;
  name: string;
  amount_cents: number;
  created_at: string;
}

export const savedPlanRepository = {
  async listAll(): Promise<SavedPlanRow[]> {
    const db = await getDb();
    return db.getAllAsync<SavedPlanRow>('SELECT * FROM saved_plans ORDER BY created_at DESC');
  },

  async findById(id: string): Promise<SavedPlanRow | null> {
    const db = await getDb();
    return db.getFirstAsync<SavedPlanRow>('SELECT * FROM saved_plans WHERE id = ?', id);
  },

  async allocationsForPlan(planId: string): Promise<SavedPlanAllocationRow[]> {
    const db = await getDb();
    return db.getAllAsync<SavedPlanAllocationRow>('SELECT * FROM saved_plan_allocations WHERE plan_id = ? ORDER BY created_at ASC', planId);
  },

  async insert(input: {
    name: string;
    expectedDate: string | null;
    plannedAmountCents: number | null;
    note: string | null;
    allocations: { name: string; amountCents: number }[];
  }): Promise<SavedPlanRow> {
    const db = await getDb();
    const id = newId();
    const now = nowISO();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO saved_plans (id, name, expected_date, planned_amount_cents, note, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
        id,
        input.name,
        input.expectedDate,
        input.plannedAmountCents,
        input.note,
        now
      );
      for (const allocation of input.allocations) {
        await db.runAsync(
          'INSERT INTO saved_plan_allocations (id, plan_id, name, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)',
          newId(),
          id,
          allocation.name,
          allocation.amountCents,
          now
        );
      }
    });
    return (await this.findById(id))!;
  },

  async replaceAllocations(planId: string, allocations: { name: string; amountCents: number }[]): Promise<void> {
    const db = await getDb();
    const now = nowISO();
    await db.runAsync('DELETE FROM saved_plan_allocations WHERE plan_id = ?', planId);
    for (const allocation of allocations) {
      await db.runAsync(
        'INSERT INTO saved_plan_allocations (id, plan_id, name, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)',
        newId(),
        planId,
        allocation.name,
        allocation.amountCents,
        now
      );
    }
  },

  async update(
    id: string,
    input: {
      name: string;
      expectedDate: string | null;
      plannedAmountCents: number | null;
      note: string | null;
      allocations: { name: string; amountCents: number }[];
    }
  ): Promise<SavedPlanRow | null> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE saved_plans SET name = ?, expected_date = ?, planned_amount_cents = ?, note = ? WHERE id = ?',
        input.name,
        input.expectedDate,
        input.plannedAmountCents,
        input.note,
        id
      );
      await this.replaceAllocations(id, input.allocations);
    });
    return this.findById(id);
  },

  async markUsed(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE saved_plans SET used_at = ? WHERE id = ?', nowISO(), id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.runAsync('DELETE FROM saved_plans WHERE id = ?', id);
    return result.changes > 0;
  },

  async insertImport(input: { planId: string; bankAccountId: string; amountCents: number; date: string }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO plan_imports (id, plan_id, bank_account_id, amount_cents, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId(),
      input.planId,
      input.bankAccountId,
      input.amountCents,
      input.date,
      nowISO()
    );
  },

  async importsForAccount(accountId: string): Promise<{ id: string; plan_id: string; plan_name: string; amount_cents: number; date: string; created_at: string }[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT pi.id, pi.plan_id, p.name AS plan_name, pi.amount_cents, pi.date, pi.created_at
       FROM plan_imports pi JOIN saved_plans p ON p.id = pi.plan_id
       WHERE pi.bank_account_id = ? ORDER BY pi.date DESC, pi.created_at DESC`,
      accountId
    );
  },
};
