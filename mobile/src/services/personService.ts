import { getDb } from '../database/sqlite';
import { personRepository, type PersonRow } from '../repositories/personRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { toCents, fromCents } from '../utils/money';
import { allocatePayments } from './debtAllocation';
import { ServiceError } from './errors';

export interface Person {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  // "outstanding" is kept as an alias of owesMe for backward compatibility.
  outstanding: string;
  owesMe: string;
  // Nothing in this app currently records money the user owes someone else
  // (every expense is paid BY the user, then split) - always zero for now,
  // but kept as a real field/Net calculation so a future feature that adds
  // that direction doesn't need a UI rework.
  iOwe: string;
  net: string;
}

export interface PersonExpenseShare {
  id: string;
  expenseId: string;
  amount: string;
  paid: string;
  remaining: string;
  status: 'paid' | 'owes';
  expense: {
    merchant: string | null;
    category: string;
    date: string;
    total: string;
    payment_method: string | null;
    credit_card_name: string | null;
  };
}

export interface PersonPayment {
  id: string;
  person_id: string;
  bank_account_id: string | null;
  amount: string;
  date: string;
  created_at: string;
  bank_account_name: string | null;
}

export interface PersonDetail {
  person: Person;
  outstanding: string;
  // Balance owed from before the app was used (not tied to any expense) -
  // needed so an itemised breakdown reconciles with the total.
  openingOwed: string;
  shares: PersonExpenseShare[];
  payments: PersonPayment[];
}

function toPerson(row: PersonRow, owesMeCents: number): Person {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    outstanding: fromCents(owesMeCents),
    owesMe: fromCents(owesMeCents),
    iOwe: '0.00',
    net: fromCents(owesMeCents),
  };
}

export const personService = {
  async listPeople(): Promise<Person[]> {
    const [people, sharesTotals, paymentTotals] = await Promise.all([personRepository.listAll(), personRepository.sharesTotalsByPerson(), personRepository.paymentTotalsByPerson()]);
    return people.map((p) => toPerson(p, p.opening_owed_cents + (sharesTotals.get(p.id) ?? 0) - (paymentTotals.get(p.id) ?? 0)));
  },

  // openingOwed lets onboarding record a pre-existing balance (from before
  // the app was used) without fabricating an expense/share for it.
  async createPerson(name: string, openingOwed = 0): Promise<Person> {
    if (!name?.trim()) throw new ServiceError(['name is required']);
    const row = await personRepository.insert(name.trim(), toCents(openingOwed));
    return toPerson(row, row.opening_owed_cents);
  },

  async fetchPerson(id: string): Promise<PersonDetail> {
    const person = await personRepository.findById(id);
    if (!person) throw new ServiceError(['Person not found'], 404);

    const [shareRows, paymentRows] = await Promise.all([personRepository.sharesForPersonWithExpense(id), personRepository.paymentsForPerson(id)]);

    const totalPaidCents = paymentRows.reduce((sum, p) => sum + p.amount_cents, 0);
    const allocations = allocatePayments(
      shareRows.map((s: any) => ({ id: s.id, amountCents: s.amount_cents })),
      totalPaidCents
    );

    const shares: PersonExpenseShare[] = shareRows
      .map((s: any) => {
        const allocation = allocations.get(s.id) ?? { paidCents: 0, remainingCents: s.amount_cents };
        return {
          id: s.id,
          expenseId: s.expense_id,
          amount: fromCents(s.amount_cents),
          paid: fromCents(allocation.paidCents),
          remaining: fromCents(allocation.remainingCents),
          status: (allocation.remainingCents <= 0 ? 'paid' : 'owes') as 'paid' | 'owes',
          expense: {
            merchant: s.merchant,
            category: s.category,
            date: s.expense_date,
            total: fromCents(s.expense_total_cents),
            payment_method: s.payment_method,
            credit_card_name: s.credit_card_name,
          },
        };
      })
      .reverse(); // most recent first for display

    const totalOwedCents = shareRows.reduce((sum: number, s: any) => sum + s.amount_cents, 0) + person.opening_owed_cents;
    const outstandingCents = totalOwedCents - totalPaidCents;

    return {
      person: toPerson(person, outstandingCents),
      outstanding: fromCents(outstandingCents),
      openingOwed: fromCents(person.opening_owed_cents),
      shares,
      payments: paymentRows.map((p) => ({
        id: p.id,
        person_id: p.person_id,
        bank_account_id: p.bank_account_id,
        amount: fromCents(p.amount_cents),
        date: p.date,
        created_at: p.created_at,
        bank_account_name: p.bank_account_name,
      })),
    };
  },

  async updatePerson(id: string, name: string): Promise<Person> {
    if (!name?.trim()) throw new ServiceError(['name is required']);
    const row = await personRepository.update(id, name.trim());
    if (!row) throw new ServiceError(['Person not found'], 404);
    const shares = await personRepository.sharesTotalForPerson(id);
    const payments = await personRepository.paymentTotalForPerson(id);
    return toPerson(row, row.opening_owed_cents + shares - payments);
  },

  async deletePerson(id: string): Promise<void> {
    const deleted = await personRepository.delete(id);
    if (!deleted) throw new ServiceError(['Person not found'], 404);
  },

  async recordPayment(personId: string, input: { amount: number; bankAccountId: string; date: string }): Promise<{ payment: PersonPayment; account: { id: string; balance: string }; outstanding: string }> {
    if (!input.amount || input.amount <= 0) throw new ServiceError(['amount must be a positive number']);
    const person = await personRepository.findById(personId);
    if (!person) throw new ServiceError(['Person not found'], 404);
    const account = await bankAccountRepository.findById(input.bankAccountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);

    const sharesTotal = await personRepository.sharesTotalForPerson(personId);
    const paymentsTotal = await personRepository.paymentTotalForPerson(personId);
    const outstandingCents = person.opening_owed_cents + sharesTotal - paymentsTotal;
    const amountCents = toCents(input.amount);
    if (amountCents > outstandingCents + 1) {
      throw new ServiceError([`Amount exceeds the outstanding balance (${fromCents(outstandingCents)})`]);
    }

    const db = await getDb();
    let paymentRow: Awaited<ReturnType<typeof personRepository.insertPayment>> | null = null;
    await db.withTransactionAsync(async () => {
      paymentRow = await personRepository.insertPayment({ personId, bankAccountId: input.bankAccountId, amountCents, date: input.date });
      await bankAccountRepository.adjustBalance(input.bankAccountId, amountCents);
    });

    const updatedAccount = await bankAccountRepository.findById(input.bankAccountId);
    const payment: PersonPayment = {
      id: paymentRow!.id,
      person_id: paymentRow!.person_id,
      bank_account_id: paymentRow!.bank_account_id,
      amount: fromCents(paymentRow!.amount_cents),
      date: paymentRow!.date,
      created_at: paymentRow!.created_at,
      bank_account_name: account.name,
    };
    return {
      payment,
      account: { id: updatedAccount!.id, balance: fromCents(updatedAccount!.balance_cents) },
      outstanding: fromCents(outstandingCents - amountCents),
    };
  },
};
