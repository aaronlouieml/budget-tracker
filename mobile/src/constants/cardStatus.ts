import type { CardStatus } from '../services/creditCardService';
import type { PillTone } from '../components/StatusPill';

export const STATUS_LABELS: Record<CardStatus, string> = {
  paid: 'Paid',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
};

// Maps each credit card status to a StatusPill tone, so a "due soon" badge
// always matches the same red used for negative amounts elsewhere, etc.
export const STATUS_TONE: Record<CardStatus, PillTone> = {
  paid: 'positive',
  due_soon: 'negative',
  upcoming: 'warning',
};
