import { apiRequest } from './client';

export interface ReceiptScanResult {
  amount: number | null;
  date: string | null;
  merchant: string | null;
  success: boolean;
  rawText: string;
  error?: string;
}

export function scanReceipt(token: string, imageBase64: string) {
  return apiRequest<ReceiptScanResult>('/receipts/scan', {
    method: 'POST',
    body: { image: imageBase64 },
    token,
  });
}
