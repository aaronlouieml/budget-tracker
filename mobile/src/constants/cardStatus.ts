import type { CardStatus } from '../services/creditCardService';

export const STATUS_LABELS: Record<CardStatus, string> = {
  paid: 'Paid',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  paid: '#2E7D32',
  due_soon: '#C62828',
  upcoming: '#6750A4',
};
