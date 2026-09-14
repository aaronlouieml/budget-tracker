import type { ReceiptScanner, ReceiptScanResult } from './types';
import { extractReceiptFields } from './extract';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';

export class OcrSpaceScanner implements ReceiptScanner {
  constructor(private apiKey: string) {}

  async scan(imageBase64: string): Promise<ReceiptScanResult> {
    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const body = new URLSearchParams({
      apikey: this.apiKey,
      base64Image: dataUri,
      OCREngine: '2',
      scale: 'true',
    });

    let response: Response;
    try {
      response = await fetch(OCR_SPACE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      return emptyResult(`Could not reach the OCR service: ${(err as Error).message}`);
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      return emptyResult('The OCR service returned an unreadable response.');
    }

    if (payload.error) {
      return emptyResult(typeof payload.error === 'string' ? payload.error : 'The OCR service reported an error.');
    }

    if (payload.IsErroredOnProcessing) {
      const message = Array.isArray(payload.ErrorMessage) ? payload.ErrorMessage.join(' ') : payload.ErrorMessage;
      return emptyResult(message || 'The OCR service could not process this image.');
    }

    const rawText: string = payload.ParsedResults?.[0]?.ParsedText ?? '';
    if (!rawText.trim()) {
      return emptyResult('No text could be read from this receipt.');
    }

    return { ...extractReceiptFields(rawText), success: true, rawText };
  }
}

function emptyResult(error: string): ReceiptScanResult {
  return { amount: null, date: null, merchant: null, success: false, rawText: '', error };
}
