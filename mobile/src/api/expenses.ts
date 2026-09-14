import { apiRequest } from './client';

export interface Expense {
  id: number;
  user_id: number;
  amount: string;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: number | null;
  receipt_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInput {
  amount: number;
  category: string;
  date: string;
  merchant: string | null;
  payment_method: string | null;
  credit_card_id: number | null;
  receipt_image: string | null;
}

export function listExpenses(token: string) {
  return apiRequest<Expense[]>('/expenses', { token });
}

export function createExpense(token: string, input: ExpenseInput) {
  return apiRequest<Expense>('/expenses', { method: 'POST', body: input, token });
}

export function updateExpense(token: string, id: number, input: ExpenseInput) {
  return apiRequest<Expense>(`/expenses/${id}`, { method: 'PUT', body: input, token });
}

export function deleteExpense(token: string, id: number) {
  return apiRequest<null>(`/expenses/${id}`, { method: 'DELETE', token });
}
