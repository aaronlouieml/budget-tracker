import { getDb } from '../database/sqlite';

// Cross-cutting read-only queries for the Home screen's summary - not scoped
// to a single account/card/person, so they don't belong in those repos.
export const homeRepository = {
  async incomeForDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDb();
    const [incoming, reimbursements, planImports] = await Promise.all([
      db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM incoming_money WHERE status = 'received' AND substr(received_at, 1, 10) BETWEEN ? AND ?`,
        startDate,
        endDate
      ),
      db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM debt_payments WHERE date BETWEEN ? AND ?', startDate, endDate),
      db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM plan_imports WHERE date BETWEEN ? AND ?', startDate, endDate),
    ]);
    return (incoming?.total ?? 0) + (reimbursements?.total ?? 0) + (planImports?.total ?? 0);
  },

  async allActiveReservations(): Promise<{ id: string; bank_account_id: string; account_name: string; name: string; amount_cents: number }[]> {
    const db = await getDb();
    return db.getAllAsync(
      `SELECT r.id, r.bank_account_id, a.name AS account_name, r.name, r.amount_cents
       FROM reservations r JOIN bank_accounts a ON a.id = r.bank_account_id
       WHERE r.status = 'reserved' ORDER BY r.created_at DESC`
    );
  },
};
