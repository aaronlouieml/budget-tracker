import { Router } from 'express';
import { getReceiptScanner } from '../services/receiptScanner';

const router = Router();

// POST /receipts/scan
router.post('/scan', async (req, res) => {
  const image = req.body?.image;
  if (typeof image !== 'string' || !image) {
    return res.status(400).json({ error: 'Validation failed', details: ['image is required'] });
  }

  try {
    const scanner = getReceiptScanner();
    const result = await scanner.scan(image);
    res.json(result);
  } catch (err) {
    console.error('Receipt scan failed', err);
    res.status(500).json({
      amount: null,
      date: null,
      merchant: null,
      success: false,
      rawText: '',
      error: 'Receipt scanning is not available right now.',
    });
  }
});

export default router;
