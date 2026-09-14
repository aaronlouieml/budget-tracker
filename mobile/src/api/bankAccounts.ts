import { apiRequest } from './client';

export type AccountType = 'savings' | 'checking' | 'cash' | 'ewallet';
export type ReservationPurpose = 'credit_card_payment' | 'bill' | 'other';
export type ReservationStatus = 'reserved' | 'fulfilled';

export interface BankAccount {
  id: number;
  user_id: number;
  name: string;
  type: AccountType;
  balance: string;
  created_at: string;
  updated_at: string;
  reserved: string;
  available: string;
}

export interface Reservation {
  id: number;
  bank_account_id: number;
  name: string;
  amount: string;
  purpose: ReservationPurpose;
  credit_card_id: number | null;
  credit_card_name: string | null;
  status: ReservationStatus;
  created_at: string;
}

export interface IncomingMoney {
  id: number;
  bank_account_id: number;
  amount: string;
  description: string | null;
  created_at: string;
}

export interface BankAccountDetail {
  account: BankAccount;
  reservations: Reservation[];
  incoming: IncomingMoney[];
  incomingTotal: string;
  potentialAvailable: string;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  balance: number;
}

export function listAccounts(token: string) {
  return apiRequest<BankAccount[]>('/bank-accounts', { token });
}

export function createAccount(token: string, input: AccountInput) {
  return apiRequest<BankAccount>('/bank-accounts', { method: 'POST', body: input, token });
}

export function fetchAccount(token: string, id: number) {
  return apiRequest<BankAccountDetail>(`/bank-accounts/${id}`, { token });
}

export function updateAccount(token: string, id: number, input: AccountInput) {
  return apiRequest<BankAccount>(`/bank-accounts/${id}`, { method: 'PUT', body: input, token });
}

export function deleteAccount(token: string, id: number) {
  return apiRequest<null>(`/bank-accounts/${id}`, { method: 'DELETE', token });
}

export interface ReservationInput {
  name: string;
  amount: number;
  purpose: ReservationPurpose;
  creditCardId: number | null;
}

export function createReservation(token: string, accountId: number, input: ReservationInput) {
  return apiRequest<Reservation>(`/bank-accounts/${accountId}/reservations`, { method: 'POST', body: input, token });
}

export function updateReservation(token: string, accountId: number, reservationId: number, input: ReservationInput) {
  return apiRequest<Reservation>(`/bank-accounts/${accountId}/reservations/${reservationId}`, {
    method: 'PUT',
    body: input,
    token,
  });
}

export function deleteReservation(token: string, accountId: number, reservationId: number) {
  return apiRequest<null>(`/bank-accounts/${accountId}/reservations/${reservationId}`, { method: 'DELETE', token });
}

export function createIncoming(token: string, accountId: number, input: { amount: number; description: string | null }) {
  return apiRequest<IncomingMoney>(`/bank-accounts/${accountId}/incoming`, { method: 'POST', body: input, token });
}

export function deleteIncoming(token: string, accountId: number, incomingId: number) {
  return apiRequest<null>(`/bank-accounts/${accountId}/incoming/${incomingId}`, { method: 'DELETE', token });
}
