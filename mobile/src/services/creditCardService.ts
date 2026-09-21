import { getDb } from '../database/sqlite';
import { creditCardRepository, type CreditCardRow } from '../repositories/creditCardRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { toCents, fromCents } from '../utils/money';
import { toExpense, type Expense } from './expenseService';
import { calculateOutstanding, calculatePayWhatIOwe } from './financialMath';
import { ServiceError } from './errors';

const DUE_SOON_DAYS = 7;

export type CardStatus = 'paid' | 'due_soon' | 'upcoming';
export type PaySource = 'available' | 'reservation';

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  due_date: number;
  created_at: string;
  updated_at: string;
  unpaid: string;
  next_due_date: string;
  days_until_due: number;
  status: CardStatus;
  myResponsibility: string;
  othersOwe: string;
  payWhatIOwe: string;
}

export interface Payment {
  id: string;
  credit_card_id: string;
  bank_account_id: string | null;
  bank_account_name: string | null;
  amount: string;
  date: string;
  created_at: string;
}

export interface CardTransaction extends Expense {
  myShare: string;
  othersOwe: string;
}

export interface CreditCardDetail {
  card: CreditCard;
  transactions: CardTransaction[];
  payments: Payment[];
}

export interface CreditCardInput {
  name: string;
  bank: string;
  dueDate: number;
  // Pre-existing outstanding balance from before the app was used (set during
  // onboarding). Not editable after creation - only new charges/payments
  // change outstanding from that point on.
  openingBalance?: number;
}

export interface PayFromAccountResult {
  payment: Payment;
  account: { id: string; balance: string; reserved: string; available: string };
  reservation: { id: string; amount: string; status: string } | null;
}

function nextDueDate(dueDay: number, from: Date): string {
  const clampToMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDay));
  };
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = clampToMonth(today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = clampToMonth(today.getFullYear(), today.getMonth() + 1);
  const year = candidate.getFullYear();
  const month = String(candidate.getMonth() + 1).padStart(2, '0');
  const day = String(candidate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / (1000 * 60 * 60 * 24));
}

function toCreditCard(
  row: CreditCardRow,
  unpaidCents: number,
  responsibility: { myResponsibilityCents: number; othersOweCents: number }
): CreditCard {
  const todayISO = new Date().toISOString().slice(0, 10);
  const dueDate = nextDueDate(row.due_date, new Date());
  const daysUntilDue = daysBetween(todayISO, dueDate);
  let status: CardStatus = unpaidCents <= 0 ? 'paid' : daysUntilDue <= DUE_SOON_DAYS ? 'due_soon' : 'upcoming';
  const payWhatIOweCents = calculatePayWhatIOwe(responsibility.myResponsibilityCents, unpaidCents);
  return {
    id: row.id,
    name: row.name,
    bank: row.bank,
    due_date: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    unpaid: fromCents(unpaidCents),
    next_due_date: dueDate,
    days_until_due: daysUntilDue,
    status,
    myResponsibility: fromCents(responsibility.myResponsibilityCents),
    othersOwe: fromCents(responsibility.othersOweCents),
    payWhatIOwe: fromCents(payWhatIOweCents),
  };
}

function toPayment(row: { id: string; credit_card_id: string; bank_account_id?: string | null; amount_cents: number; date: string; created_at: string; bank_account_name?: string | null }): Payment {
  return {
    id: row.id,
    credit_card_id: row.credit_card_id,
    bank_account_id: row.bank_account_id ?? null,
    bank_account_name: row.bank_account_name ?? null,
    amount: fromCents(row.amount_cents),
    date: row.date,
    created_at: row.created_at,
  };
}

function validateInput(input: CreditCardInput) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  if (!input.bank?.trim()) errors.push('bank is required');
  if (!Number.isInteger(input.dueDate) || input.dueDate < 1 || input.dueDate > 31) errors.push('dueDate must be a day of month between 1 and 31');
  if (errors.length > 0) throw new ServiceError(errors);
}

export const creditCardService = {
  async listCards(): Promise<CreditCard[]> {
    const [cards, totals] = await Promise.all([creditCardRepository.listAll(), creditCardRepository.outstandingTotals()]);
    const responsibilities = await Promise.all(cards.map((c) => creditCardRepository.responsibilityTotals(c.id)));
    return cards
      .map((c, i) => toCreditCard(c, totals.get(c.id) ?? 0, responsibilities[i]))
      .sort((a, b) => a.days_until_due - b.days_until_due);
  },

  async createCard(input: CreditCardInput): Promise<CreditCard> {
    validateInput(input);
    const openingBalanceCents = toCents(input.openingBalance || 0);
    const row = await creditCardRepository.insert({
      name: input.name.trim(),
      bank: input.bank.trim(),
      dueDate: input.dueDate,
      openingBalanceCents,
    });
    return toCreditCard(row, openingBalanceCents, { myResponsibilityCents: openingBalanceCents, othersOweCents: 0 });
  },

  async fetchCard(id: string): Promise<CreditCardDetail> {
    const card = await creditCardRepository.findById(id);
    if (!card) throw new ServiceError(['Credit card not found'], 404);
    const [transactions, payments, shareTotals, responsibility] = await Promise.all([
      creditCardRepository.transactionsForCard(id),
      creditCardRepository.paymentsForCard(id),
      creditCardRepository.shareTotalsForCard(id),
      creditCardRepository.responsibilityTotals(id),
    ]);
    const totalExpenses = transactions.reduce((sum: number, t: any) => sum + t.amount_cents, 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    return {
      card: toCreditCard(card, calculateOutstanding(card.opening_balance_cents, totalExpenses, totalPayments), responsibility),
      transactions: transactions.map((t: any) => {
        const sharesTotal = shareTotals.get(t.id) ?? 0;
        return { ...toExpense(t), myShare: fromCents(t.amount_cents - sharesTotal), othersOwe: fromCents(sharesTotal) };
      }),
      payments: payments.map(toPayment),
    };
  },

  async updateCard(id: string, input: CreditCardInput): Promise<CreditCard> {
    validateInput(input);
    const row = await creditCardRepository.update(id, { name: input.name.trim(), bank: input.bank.trim(), dueDate: input.dueDate });
    if (!row) throw new ServiceError(['Credit card not found'], 404);
    const [outstanding, responsibility] = await Promise.all([
      creditCardRepository.outstandingForCard(id),
      creditCardRepository.responsibilityTotals(id),
    ]);
    return toCreditCard(row, outstanding, responsibility);
  },

  async deleteCard(id: string): Promise<void> {
    const deleted = await creditCardRepository.delete(id);
    if (!deleted) throw new ServiceError(['Credit card not found'], 404);
  },

  // Pays a card from a bank account in one step: records the payment (not an
  // expense), debits the account, and - depending on source - either leaves
  // reservations untouched or reduces/fulfills one specific reservation
  // (including partial payments).
  async payFromAccount(
    cardId: string,
    input: { amount: number; bankAccountId: string; source: PaySource; reservationId?: string; date: string }
  ): Promise<PayFromAccountResult> {
    if (!input.amount || input.amount <= 0) throw new ServiceError(['amount must be a positive number']);
    if (input.source === 'reservation' && !input.reservationId) throw new ServiceError(['reservationId is required when source is "reservation"']);

    const card = await creditCardRepository.findById(cardId);
    if (!card) throw new ServiceError(['Credit card not found'], 404);
    const account = await bankAccountRepository.findById(input.bankAccountId);
    if (!account) throw new ServiceError(['Bank account not found'], 404);
    if (account.balance_cents < 0) throw new ServiceError(['Cannot pay from a negative balance']);

    const outstandingCents = await creditCardRepository.outstandingForCard(cardId);
    const amountCents = toCents(input.amount);
    if (amountCents > outstandingCents + 1) {
      throw new ServiceError([`Amount exceeds the card's outstanding balance (${fromCents(outstandingCents)})`]);
    }

    let reservation = null;
    if (input.source === 'reservation') {
      reservation = await bankAccountRepository.findReservation(input.bankAccountId, input.reservationId!);
      if (!reservation || reservation.status !== 'reserved') throw new ServiceError(['Reservation not found'], 404);
      if (amountCents > reservation.amount_cents + 1) {
        throw new ServiceError([`Amount exceeds the reservation's balance (${fromCents(reservation.amount_cents)})`]);
      }
    } else {
      const reservedCents = await bankAccountRepository.reservedTotalForAccount(input.bankAccountId);
      const availableCents = account.balance_cents - reservedCents;
      if (amountCents > availableCents + 1) {
        throw new ServiceError([`Amount exceeds the account's available balance (${fromCents(availableCents)})`]);
      }
    }

    const db = await getDb();
    let payment: Payment | null = null;
    let updatedReservation: { id: string; amount: string; status: string } | null = null;
    await db.withTransactionAsync(async () => {
      const paymentRow = await creditCardRepository.insertPayment({ creditCardId: cardId, bankAccountId: input.bankAccountId, amountCents, date: input.date });
      payment = toPayment({ ...paymentRow, bank_account_name: account.name });

      await bankAccountRepository.adjustBalance(input.bankAccountId, -amountCents);

      if (reservation) {
        const remaining = reservation.amount_cents - amountCents;
        if (remaining <= 1) {
          await bankAccountRepository.setReservationAmount(reservation.id, 0, 'fulfilled', 'payment');
          updatedReservation = { id: reservation.id, amount: '0.00', status: 'fulfilled' };
        } else {
          await bankAccountRepository.setReservationAmount(reservation.id, remaining, 'reserved');
          updatedReservation = { id: reservation.id, amount: fromCents(remaining), status: 'reserved' };
        }
      }
    });

    const updatedAccount = await bankAccountRepository.findById(input.bankAccountId);
    const reservedCents = await bankAccountRepository.reservedTotalForAccount(input.bankAccountId);
    const balanceCents = updatedAccount!.balance_cents;

    return {
      payment: payment!,
      account: {
        id: updatedAccount!.id,
        balance: fromCents(balanceCents),
        reserved: fromCents(reservedCents),
        available: fromCents(balanceCents - reservedCents),
      },
      reservation: updatedReservation,
    };
  },
};
