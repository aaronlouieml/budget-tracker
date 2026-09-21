// Tags each expense with how it was created, so the UI can show a "Scanned"
// indicator on receipt-OCR-created expenses without guessing from other
// fields (e.g. presence of receipt_image alone isn't enough - a manually
// entered expense can also attach a photo). Existing rows default to
// 'manual' since they predate OCR.
export const MIGRATION_005_RECEIPT_SCAN_SOURCE = `
ALTER TABLE expenses ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','scan'));
`;
