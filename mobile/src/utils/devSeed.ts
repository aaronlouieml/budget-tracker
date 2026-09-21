import { getDb } from '../database/sqlite';
import { bankAccountService } from '../services/bankAccountService';
import { creditCardService } from '../services/creditCardService';
import { personService } from '../services/personService';
import { expenseService } from '../services/expenseService';
import { recurringPaymentService } from '../services/recurringPaymentService';
import { savedPlanService } from '../services/savedPlanService';
import { todayISODate } from './format';

const TABLES = [
  'transfers',
  'debt_payments',
  'expense_shares',
  'payments',
  'reservations',
  'incoming_money',
  'expenses',
  'recurring_payments',
  'plan_imports',
  'saved_plan_allocations',
  'saved_plans',
  'people',
  'credit_cards',
  'bank_accounts',
];

async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
  });
}

// Dev-only helper (see the __DEV__-gated button in AppNavigator) that walks
// through the exact scenario from the feature spec's final test section,
// using the real services - so it's a faithful exercise of the whole
// account/credit-card/shared-expense/transfer flow, not just inserted rows.
export async function seedTestData(): Promise<void> {
  await resetAllData();
  const today = todayISODate();

  const account = await bankAccountService.createAccount({ name: 'BPI Savings', type: 'savings', balance: 50_000 });
  const card = await creditCardService.createCard({ name: 'BPI Mastercard', bank: 'BPI', dueDate: 25 });
  await bankAccountService.createReservation(account.id, {
    name: 'Emergency Fund',
    amount: 20_000,
    purpose: 'other',
    creditCardId: null,
    category: 'Savings Goal',
    plannedDate: null,
  });

  const mau = await personService.createPerson('Mau');

  await expenseService.createExpense({
    amount: 2_000,
    category: 'Food',
    date: today,
    merchant: 'Restaurant',
    payment_method: 'credit_card',
    credit_card_id: card.id,
    bank_account_id: null,
    receipt_image: null,
    source: 'manual',
    shares: [{ personId: mau.id, amount: 1_000 }],
  });

  const cardDetail = await creditCardService.fetchCard(card.id);
  await creditCardService.payFromAccount(card.id, {
    amount: Number(cardDetail.card.payWhatIOwe),
    bankAccountId: account.id,
    source: 'available',
    date: today,
  });

  await personService.recordPayment(mau.id, { amount: 1_000, bankAccountId: account.id, date: today });

  // A second card with an opening balance and a partially-repaid shared
  // expense, to exercise the opening-balance mechanism and partial-repayment
  // math (as opposed to the fully-repaid scenario above).
  const secondCard = await creditCardService.createCard({ name: 'BDO Visa', bank: 'BDO', dueDate: 10, openingBalance: 5_000 });
  const jam = await personService.createPerson('Jam', 500);
  await expenseService.createExpense({
    amount: 3_000,
    category: 'Utilities',
    date: today,
    merchant: 'Meralco',
    payment_method: 'credit_card',
    credit_card_id: secondCard.id,
    bank_account_id: null,
    receipt_image: null,
    source: 'manual',
    shares: [{ personId: jam.id, amount: 1_500 }],
  });
  await personService.recordPayment(jam.id, { amount: 800, bankAccountId: account.id, date: today });

  await recurringPaymentService.create({
    creditCardId: card.id,
    name: 'Netflix',
    amount: 549,
    frequency: 'monthly',
    nextDate: today,
    category: 'Subscriptions',
  });

  await savedPlanService.createPlan({
    name: '13th Month Pay',
    expectedDate: null,
    plannedAmount: 30_000,
    note: null,
    allocations: [
      { name: 'Christmas Gifts', amount: 10_000 },
      { name: 'Savings', amount: 20_000 },
    ],
  });
}
