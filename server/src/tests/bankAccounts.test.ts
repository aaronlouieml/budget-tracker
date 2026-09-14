import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import 'dotenv/config';
import { app } from '../app';
import { pool } from '../db';

let server: Server;
let baseUrl: string;

const RUN_ID = Date.now();
const userAEmail = `phase7-a-${RUN_ID}@example.com`;
const userBEmail = `phase7-b-${RUN_ID}@example.com`;
let tokenA: string;
let tokenB: string;

interface ApiResult {
  status: number;
  body: any;
}

async function api(path: string, opts: { method?: string; body?: any; token?: string } = {}): Promise<ApiResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

async function createAccount(token: string, name: string, balance: number, type = 'savings') {
  const result = await api('/bank-accounts', { method: 'POST', body: { name, type, balance }, token });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

async function createCard(token: string, name: string) {
  const result = await api('/credit-cards', { method: 'POST', body: { name, bank: 'Test Bank', dueDate: 15 }, token });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

// Builds up a card's outstanding balance via a plain expense, mirroring how a
// real purchase would (a credit card purchase is always an Expense).
async function chargeCard(token: string, cardId: number, amount: number) {
  const result = await api('/expenses', {
    method: 'POST',
    body: { amount, category: 'Shopping', date: '2026-01-01', credit_card_id: cardId, payment_method: 'credit_card' },
    token,
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://localhost:${port}`;

  const regA = await api('/auth/register', { method: 'POST', body: { email: userAEmail, password: 'testpass123' } });
  assert.equal(regA.status, 201, JSON.stringify(regA.body));
  tokenA = regA.body.token;

  const regB = await api('/auth/register', { method: 'POST', body: { email: userBEmail, password: 'testpass123' } });
  assert.equal(regB.status, 201, JSON.stringify(regB.body));
  tokenB = regB.body.token;
});

after(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [[userAEmail, userBEmail]]);
  await pool.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Bank accounts', () => {
  test('create, retrieve, update balance, and delete an account', async () => {
    const created = await createAccount(tokenA, 'BPI Savings', 67692.38);
    assert.equal(created.balance, '67692.38');
    assert.equal(created.reserved, '0.00');
    assert.equal(created.available, '67692.38');

    const detail = await api(`/bank-accounts/${created.id}`, { token: tokenA });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.account.name, 'BPI Savings');

    const updated = await api(`/bank-accounts/${created.id}`, {
      method: 'PUT',
      body: { name: 'BPI Savings', type: 'savings', balance: 70000 },
      token: tokenA,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.balance, '70000.00');

    const deleted = await api(`/bank-accounts/${created.id}`, { method: 'DELETE', token: tokenA });
    assert.equal(deleted.status, 204);

    const afterDelete = await api(`/bank-accounts/${created.id}`, { token: tokenA });
    assert.equal(afterDelete.status, 404);
  });

  test('user isolation: another user cannot view, modify, or delete the account', async () => {
    const account = await createAccount(tokenA, 'Isolation Test', 1000);

    const getOther = await api(`/bank-accounts/${account.id}`, { token: tokenB });
    assert.equal(getOther.status, 404);

    const putOther = await api(`/bank-accounts/${account.id}`, {
      method: 'PUT',
      body: { name: 'Hijacked', type: 'savings', balance: 0 },
      token: tokenB,
    });
    assert.equal(putOther.status, 404);

    const deleteOther = await api(`/bank-accounts/${account.id}`, { method: 'DELETE', token: tokenB });
    assert.equal(deleteOther.status, 404);

    const listOther = await api('/bank-accounts', { token: tokenB });
    assert.equal(listOther.status, 200);
    assert.ok(!listOther.body.some((a: any) => a.id === account.id));
  });
});

describe('Reservations', () => {
  test('multiple reservations, totals, edit, and release', async () => {
    const account = await createAccount(tokenA, 'BPI Savings Reservations', 100000);

    const cc = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'BPI Credit Card', amount: 20000, purpose: 'credit_card_payment', creditCardId: null },
      token: tokenA,
    });
    assert.equal(cc.status, 201);
    assert.equal(cc.body.name, 'BPI Credit Card');

    const rent = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Rent', amount: 15000, purpose: 'bill', creditCardId: null },
      token: tokenA,
    });
    assert.equal(rent.status, 201);

    const vacation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Vacation', amount: 10000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(vacation.status, 201);

    let detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.reserved, '45000.00');
    assert.equal(detail.body.account.available, '55000.00');
    assert.equal(detail.body.reservations.length, 3);

    // Edit: bump Vacation from 10000 -> 12000 (still within the 55000 available headroom).
    const editVacation = await api(`/bank-accounts/${account.id}/reservations/${vacation.body.id}`, {
      method: 'PUT',
      body: { name: 'Vacation', amount: 12000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(editVacation.status, 200);
    assert.equal(editVacation.body.amount, '12000.00');

    detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.reserved, '47000.00');
    assert.equal(detail.body.account.available, '53000.00');

    // Release the Rent reservation.
    const releaseRent = await api(`/bank-accounts/${account.id}/reservations/${rent.body.id}`, {
      method: 'DELETE',
      token: tokenA,
    });
    assert.equal(releaseRent.status, 204);

    detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.reserved, '32000.00');
    assert.equal(detail.body.account.available, '68000.00');
  });

  test('prevents over-reservation on create and on edit', async () => {
    const account = await createAccount(tokenA, 'Over Reservation Test', 50000);

    const first = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Existing', amount: 40000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(first.status, 201);

    // Only 10000 available now; asking for 20000 must be rejected.
    const overReserve = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Too Much', amount: 20000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(overReserve.status, 400);

    // Exactly the remaining 10000 must be accepted.
    const exactFit = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Exactly Fits', amount: 10000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(exactFit.status, 201);

    // Editing "Existing" (10000 -> 45000, current balance 50000) up to a point that would
    // push total reservations over the account balance must be rejected.
    const account2 = await createAccount(tokenA, 'Edit Over Reservation', 50000);
    const reservation = await api(`/bank-accounts/${account2.id}/reservations`, {
      method: 'POST',
      body: { name: 'Adjustable', amount: 10000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(reservation.status, 201);

    const overEdit = await api(`/bank-accounts/${account2.id}/reservations/${reservation.body.id}`, {
      method: 'PUT',
      body: { name: 'Adjustable', amount: 60000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(overEdit.status, 400);

    const validEdit = await api(`/bank-accounts/${account2.id}/reservations/${reservation.body.id}`, {
      method: 'PUT',
      body: { name: 'Adjustable', amount: 45000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(validEdit.status, 200);
  });

  test('creating a reservation never changes the account current balance', async () => {
    const account = await createAccount(tokenA, 'Floating Reservation Test', 100000);
    await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Credit Card', amount: 20000, purpose: 'credit_card_payment', creditCardId: null },
      token: tokenA,
    });
    const detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '100000.00');
    assert.equal(detail.body.account.available, '80000.00');
  });

  test('user isolation: another user cannot view, create, edit, or delete reservations', async () => {
    const account = await createAccount(tokenA, 'Reservation Isolation', 10000);
    const reservation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Mine', amount: 1000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });
    assert.equal(reservation.status, 201);

    const createOther = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Hijack', amount: 500, purpose: 'other', creditCardId: null },
      token: tokenB,
    });
    assert.equal(createOther.status, 404);

    const editOther = await api(`/bank-accounts/${account.id}/reservations/${reservation.body.id}`, {
      method: 'PUT',
      body: { name: 'Hijack', amount: 1, purpose: 'other', creditCardId: null },
      token: tokenB,
    });
    assert.equal(editOther.status, 404);

    const deleteOther = await api(`/bank-accounts/${account.id}/reservations/${reservation.body.id}`, {
      method: 'DELETE',
      token: tokenB,
    });
    assert.equal(deleteOther.status, 404);

    const viewOther = await api(`/bank-accounts/${account.id}`, { token: tokenB });
    assert.equal(viewOther.status, 404);
  });
});

describe('Credit card payments', () => {
  test('record payment without an account: reduces outstanding, no expense created', async () => {
    const card = await createCard(tokenA, 'Record Payment Card');
    await chargeCard(tokenA, card.id, 13012.38);

    const beforeExpenseCount = (await api(`/credit-cards/${card.id}`, { token: tokenA })).body.transactions.length;

    const payment = await api(`/credit-cards/${card.id}/payments`, {
      method: 'POST',
      body: { amount: 13012.38, date: '2026-01-05' },
      token: tokenA,
    });
    assert.equal(payment.status, 201);

    const detail = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(detail.body.card.unpaid, '0.00');
    assert.equal(detail.body.card.status, 'paid');
    assert.equal(detail.body.transactions.length, beforeExpenseCount);
  });

  test('pay from account using available money leaves reservations untouched', async () => {
    const account = await createAccount(tokenA, 'Available Pay Account', 67692.38);
    const card = await createCard(tokenA, 'Available Pay Card');
    await chargeCard(tokenA, card.id, 13012.38);

    // An unrelated reservation should remain exactly as-is.
    const reservation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Rent', amount: 15000, purpose: 'bill', creditCardId: null },
      token: tokenA,
    });
    assert.equal(reservation.status, 201);

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 13012.38, bankAccountId: account.id, source: 'available' },
      token: tokenA,
    });
    assert.equal(pay.status, 201, JSON.stringify(pay.body));
    assert.equal(pay.body.account.balance, '54680.00');
    assert.equal(pay.body.account.reserved, '15000.00');
    assert.equal(pay.body.account.available, '39680.00');
    assert.equal(pay.body.reservation, null);

    const cardDetail = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(cardDetail.body.card.unpaid, '0.00');

    const reservationCheck = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    const rentAfter = reservationCheck.body.reservations.find((r: any) => r.id === reservation.body.id);
    assert.equal(rentAfter.amount, '15000.00');
    assert.equal(rentAfter.status, 'reserved');
  });

  test('full payment scenario: reserve for a card, then pay using that reservation', async () => {
    const account = await createAccount(tokenA, 'BPI Savings Scenario', 67692.38);
    const card = await createCard(tokenA, 'BPI Mastercard');
    await chargeCard(tokenA, card.id, 13012.38);

    const reservation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'BPI Mastercard', amount: 13012.38, purpose: 'credit_card_payment', creditCardId: card.id },
      token: tokenA,
    });
    assert.equal(reservation.status, 201);

    let detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '67692.38');
    assert.equal(detail.body.account.reserved, '13012.38');
    assert.equal(detail.body.account.available, '54680.00');

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 13012.38, bankAccountId: account.id, source: 'reservation', reservationId: reservation.body.id },
      token: tokenA,
    });
    assert.equal(pay.status, 201, JSON.stringify(pay.body));
    assert.equal(pay.body.account.balance, '54680.00');
    assert.equal(pay.body.account.reserved, '0.00');
    assert.equal(pay.body.account.available, '54680.00');
    assert.equal(pay.body.reservation.status, 'fulfilled');
    assert.equal(pay.body.reservation.amount, '0.00');

    const cardDetail = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(cardDetail.body.card.unpaid, '0.00');

    // No expense was created by the payment.
    assert.equal(cardDetail.body.transactions.length, 1);
    assert.equal(cardDetail.body.payments.length, 1);
  });

  test('partial payment from a reservation reduces it without zeroing it out', async () => {
    const account = await createAccount(tokenA, 'Partial Payment Account', 100000);
    const card = await createCard(tokenA, 'Partial Payment Card');
    await chargeCard(tokenA, card.id, 20000);

    const reservation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Card Reserve', amount: 20000, purpose: 'credit_card_payment', creditCardId: card.id },
      token: tokenA,
    });
    assert.equal(reservation.status, 201);

    const firstPay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 12000, bankAccountId: account.id, source: 'reservation', reservationId: reservation.body.id },
      token: tokenA,
    });
    assert.equal(firstPay.status, 201);
    assert.equal(firstPay.body.reservation.status, 'reserved');
    assert.equal(firstPay.body.reservation.amount, '8000.00');
    assert.equal(firstPay.body.account.balance, '88000.00');

    const cardAfterFirst = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(cardAfterFirst.body.card.unpaid, '8000.00');

    const secondPay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 8000, bankAccountId: account.id, source: 'reservation', reservationId: reservation.body.id },
      token: tokenA,
    });
    assert.equal(secondPay.status, 201);
    assert.equal(secondPay.body.reservation.status, 'fulfilled');
    assert.equal(secondPay.body.reservation.amount, '0.00');
    assert.equal(secondPay.body.account.balance, '80000.00');

    const cardAfterSecond = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(cardAfterSecond.body.card.unpaid, '0.00');
    assert.equal(cardAfterSecond.body.card.status, 'paid');
  });

  test('rejects a payment larger than the account available balance', async () => {
    const account = await createAccount(tokenA, 'Overpay Available Account', 5000);
    const card = await createCard(tokenA, 'Overpay Available Card');
    await chargeCard(tokenA, card.id, 20000);

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 5001, bankAccountId: account.id, source: 'available' },
      token: tokenA,
    });
    assert.equal(pay.status, 400);

    // Nothing should have changed.
    const detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '5000.00');
  });

  test('rejects a payment larger than the selected reservation', async () => {
    const account = await createAccount(tokenA, 'Overpay Reservation Account', 50000);
    const card = await createCard(tokenA, 'Overpay Reservation Card');
    await chargeCard(tokenA, card.id, 20000);

    const reservation = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Small Reserve', amount: 5000, purpose: 'credit_card_payment', creditCardId: card.id },
      token: tokenA,
    });

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 5001, bankAccountId: account.id, source: 'reservation', reservationId: reservation.body.id },
      token: tokenA,
    });
    assert.equal(pay.status, 400);

    const detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '50000.00');
    const reservationAfter = detail.body.reservations.find((r: any) => r.id === reservation.body.id);
    assert.equal(reservationAfter.amount, '5000.00');
  });

  test('rejects a payment larger than the card outstanding balance', async () => {
    const account = await createAccount(tokenA, 'Overpay Card Account', 50000);
    const card = await createCard(tokenA, 'Overpay Card Card');
    await chargeCard(tokenA, card.id, 1000);

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 1001, bankAccountId: account.id, source: 'available' },
      token: tokenA,
    });
    assert.equal(pay.status, 400);

    const detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '50000.00');
  });

  test('a failed payment leaves everything unchanged (atomicity)', async () => {
    const account = await createAccount(tokenA, 'Atomicity Account', 10000);
    const card = await createCard(tokenA, 'Atomicity Card');
    await chargeCard(tokenA, card.id, 5000);

    const beforeCard = await api(`/credit-cards/${card.id}`, { token: tokenA });

    // Nonexistent reservation id forces a rollback deep in the transaction.
    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 1000, bankAccountId: account.id, source: 'reservation', reservationId: 9999999 },
      token: tokenA,
    });
    assert.equal(pay.status, 404);

    const afterAccount = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(afterAccount.body.account.balance, '10000.00');

    const afterCard = await api(`/credit-cards/${card.id}`, { token: tokenA });
    assert.equal(afterCard.body.card.unpaid, beforeCard.body.card.unpaid);
    assert.equal(afterCard.body.payments.length, beforeCard.body.payments.length);
  });
});

describe('Important calculation test (spec example)', () => {
  test('paying off a reservation releases it while keeping available balance unchanged', async () => {
    const account = await createAccount(tokenA, 'Calculation Test Account', 100000);
    const card = await createCard(tokenA, 'Calculation Test Card');
    await chargeCard(tokenA, card.id, 20000);

    const cc = await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'CC', amount: 20000, purpose: 'credit_card_payment', creditCardId: card.id },
      token: tokenA,
    });
    await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Rent', amount: 15000, purpose: 'bill', creditCardId: null },
      token: tokenA,
    });
    await api(`/bank-accounts/${account.id}/reservations`, {
      method: 'POST',
      body: { name: 'Vacation', amount: 10000, purpose: 'other', creditCardId: null },
      token: tokenA,
    });

    let detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.reserved, '45000.00');
    assert.equal(detail.body.account.available, '55000.00');

    const pay = await api(`/credit-cards/${card.id}/pay-from-account`, {
      method: 'POST',
      body: { amount: 20000, bankAccountId: account.id, source: 'reservation', reservationId: cc.body.id },
      token: tokenA,
    });
    assert.equal(pay.status, 201, JSON.stringify(pay.body));

    detail = await api(`/bank-accounts/${account.id}`, { token: tokenA });
    assert.equal(detail.body.account.balance, '80000.00');
    assert.equal(detail.body.account.reserved, '25000.00');
    assert.equal(detail.body.account.available, '55000.00');
  });
});
