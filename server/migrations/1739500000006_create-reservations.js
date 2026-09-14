exports.up = (pgm) => {
  pgm.createTable('reservations', {
    id: 'id',
    bank_account_id: {
      type: 'integer',
      notNull: true,
      references: '"bank_accounts"',
      onDelete: 'CASCADE',
    },
    amount: { type: 'numeric(12,2)', notNull: true },
    purpose: { type: 'varchar(30)', notNull: true, check: "purpose IN ('credit_card_payment', 'bill', 'other')" },
    // Detach (not delete) if the card is removed later, same as expenses.credit_card_id.
    credit_card_id: {
      type: 'integer',
      references: '"credit_cards"',
      onDelete: 'SET NULL',
    },
    status: { type: 'varchar(20)', notNull: true, default: 'reserved', check: "status IN ('reserved', 'fulfilled')" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('reservations', 'bank_account_id');
  pgm.createIndex('reservations', 'credit_card_id');
};

exports.down = (pgm) => {
  pgm.dropTable('reservations');
};
