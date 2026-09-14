import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import expensesRouter from './routes/expenses';
import dashboardRouter from './routes/dashboard';
import creditCardsRouter from './routes/creditCards';
import receiptsRouter from './routes/receipts';
import reportsRouter from './routes/reports';
import bankAccountsRouter from './routes/bankAccounts';
import { requireAuth } from './middleware/auth';

export const app = express();

app.use(cors());
// Raised from the default 100kb so receipt photos (sent as base64 JSON) fit.
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/expenses', requireAuth, expensesRouter);
app.use('/dashboard', requireAuth, dashboardRouter);
app.use('/credit-cards', requireAuth, creditCardsRouter);
app.use('/receipts', requireAuth, receiptsRouter);
app.use('/reports', requireAuth, reportsRouter);
app.use('/bank-accounts', requireAuth, bankAccountsRouter);
