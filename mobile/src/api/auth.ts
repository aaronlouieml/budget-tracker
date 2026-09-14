import { apiRequest } from './client';

export interface AuthUser {
  id: number;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function register(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: { email, password } });
}

export function login(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

export function fetchMe(token: string) {
  return apiRequest<AuthUser>('/auth/me', { token });
}
