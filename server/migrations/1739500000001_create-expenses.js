exports.up = (pgm) => {
  pgm.createTable('expenses', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    amount: { type: 'numeric(12,2)', notNull: true },
    category: { type: 'varchar(100)', notNull: true },
    date: { type: 'date', notNull: true },
    merchant: { type: 'varchar(255)' },
    payment_method: { type: 'varchar(50)' },
    // No FK yet: credit_cards table doesn't exist until a later phase.
    credit_card_id: { type: 'integer' },
    receipt_image: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('expenses', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('expenses');
};
