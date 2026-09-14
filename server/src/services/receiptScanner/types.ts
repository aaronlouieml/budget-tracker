export interface ExtractedReceipt {
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  merchant: string | null;
}

export interface ReceiptScanResult extends ExtractedReceipt {
  success: boolean;
  rawText: string;
  error?: string;
}

// Isolates the OCR provider behind one method so it can be swapped
// (e.g. OCR.space -> Google Cloud Vision) without touching callers.
export interface ReceiptScanner {
  scan(imageBase64: string): Promise<ReceiptScanResult>;
}
