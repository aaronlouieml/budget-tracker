import type { ReceiptScanner } from './types';
import { OcrSpaceScanner } from './ocrSpaceScanner';

export type { ReceiptScanner, ReceiptScanResult, ExtractedReceipt } from './types';

// Swap providers by setting OCR_PROVIDER and its matching API key env var.
// Currently supported: "ocrspace" (https://ocr.space/ocrapi), using OCR_SPACE_API_KEY.
export function getReceiptScanner(): ReceiptScanner {
  const provider = process.env.OCR_PROVIDER ?? 'ocrspace';

  switch (provider) {
    case 'ocrspace': {
      const apiKey = process.env.OCR_SPACE_API_KEY;
      if (!apiKey) {
        throw new Error('OCR_SPACE_API_KEY environment variable is required when OCR_PROVIDER=ocrspace');
      }
      return new OcrSpaceScanner(apiKey);
    }
    default:
      throw new Error(`Unknown OCR_PROVIDER "${provider}"`);
  }
}
