import { apiRequest } from './client';
import type { Expense } from './expenses';

export type CardStatus = 'paid' | 'due_soon' | 'upcoming';

export interface CreditCard {
  id: number;
  user_id: number;
  name: string;
  bank: string;
  due_date: number;
  created_at: string;
  updated_at: string;
  unpaid: string;
  next_due_date: string;
  days_until_due: number;
  status: CardStatus;
}

export interface Payment {
  id: number;
  credit_card_id: number;
  amount: string;
  date: string;
  created_at: string;
}

export interface CreditCardDetail {
  card: CreditCard;
  transactions: Expense[];
  payments: Payment[];
}

export interface CreditCardInput {
  name: string;
  bank: string;
  dueDate: number;
}

export function listCreditCards(token: string) {
  return apiRequest<CreditCard[]>('/credit-cards', { token });
}

export function createCreditCard(token: string, input: CreditCardInput) {
  return apiRequest<CreditCard>('/credit-cards', { method: 'POST', body: input, token });
}

export function fetchCreditCard(token: string, id: number) {
  return apiRequest<CreditCardDetail>(`/credit-cards/${id}`, { token });
}

export function updateCreditCard(token: string, id: number, input: CreditCardInput) {
  return apiRequest<CreditCard>(`/credit-cards/${id}`, { method: 'PUT', body: input, token });
}

export function deleteCreditCard(token: string, id: number) {
  return apiRequest<null>(`/credit-cards/${id}`, { method: 'DELETE', token });
}

export function recordPayment(token: string, id: number, input: { amount: number; date: string }) {
  return apiRequest<Payment>(`/credit-cards/${id}/payments`, { method: 'POST', body: input, token });
}

export type PaySource = 'available' | 'reservation';

export interface PayFromAccountResult {
  payment: Payment;
  account: { id: number; balance: string; reserved: string; available: string };
  reservation: { id: number; amount: string; status: string } | null;
}

export function payFromAccount(
  token: string,
  cardId: number,
  input: { bankAccountId: number; amount: number; source: PaySource; reservationId?: number; date?: string }
) {
  return apiRequest<PayFromAccountResult>(`/credit-cards/${cardId}/pay-from-account`, {
    method: 'POST',
    body: input,
    token,
  });
}
