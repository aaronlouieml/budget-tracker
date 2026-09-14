exports.up = (pgm) => {
  pgm.createTable('payments', {
    id: 'id',
    credit_card_id: {
      type: 'integer',
      notNull: true,
      references: '"credit_cards"',
      onDelete: 'CASCADE',
    },
    amount: { type: 'numeric(12,2)', notNull: true },
    date: { type: 'date', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('payments', 'credit_card_id');
};

exports.down = (pgm) => {
  pgm.dropTable('payments');
};
