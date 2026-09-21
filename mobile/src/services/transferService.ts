import { getDb } from '../database/sqlite';
import { transferRepository, type TransferRow } from '../repositories/transferRepository';
import { bankAccountRepository } from '../repositories/bankAccountRepository';
import { toCents, fromCents } from '../utils/money';
import { calculateAvailable } from './financialMath';
import { ServiceError } from './errors';

export interface Transfer {
  id: string;
  from_account_id: string;
  from_account_name: string;
  to_account_id: string;
  to_account_name: string;
  amount: string;
  note: string | null;
  date: string;
  created_at: string;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note: string | null;
  date: string;
}

function toTransfer(row: TransferRow & { from_account_name: string; to_account_name: string }): Transfer {
  return {
    id: row.id,
    from_account_id: row.from_account_id,
    from_account_name: row.from_account_name,
    to_account_id: row.to_account_id,
    to_account_name: row.to_account_name,
    amount: fromCents(row.amount_cents),
    note: row.note,
    date: row.date,
    created_at: row.created_at,
  };
}

export const transferService = {
  async createTransfer(input: TransferInput): Promise<Transfer> {
    if (input.fromAccountId === input.toAccountId) throw new ServiceError(['Cannot transfer to the same account']);
    if (!input.amount || Number.isNaN(Number(input.amount)) || input.amount <= 0) throw new ServiceError(['amount must be a positive number']);

    const fromAccount = await bankAccountRepository.findById(input.fromAccountId);
    if (!fromAccount) throw new ServiceError(['Source account not found'], 404);
    if (fromAccount.balance_cents < 0) throw new ServiceError(['Cannot transfer from a negative balance']);
    const toAccount = await bankAccountRepository.findById(input.toAccountId);
    if (!toAccount) throw new ServiceError(['Destination account not found'], 404);

    const amountCents = toCents(input.amount);
    const reservedCents = await bankAccountRepository.reservedTotalForAccount(input.fromAccountId);
    const availableCents = calculateAvailable(fromAccount.balance_cents, reservedCents);
    if (amountCents > availableCents + 1) {
      throw new ServiceError([`Amount exceeds the account's available balance (${fromCents(availableCents)})`]);
    }

    const db = await getDb();
    let created: TransferRow | null = null;
    await db.withTransactionAsync(async () => {
      created = await transferRepository.insert({
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountCents,
        note: input.note?.trim() || null,
        date: input.date,
      });
      await bankAccountRepository.adjustBalance(input.fromAccountId, -amountCents);
      await bankAccountRepository.adjustBalance(input.toAccountId, amountCents);
    });

    return { ...toTransfer({ ...created!, from_account_name: fromAccount.name, to_account_name: toAccount.name }) };
  },
};
