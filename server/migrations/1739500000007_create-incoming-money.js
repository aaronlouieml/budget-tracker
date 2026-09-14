exports.up = (pgm) => {
  pgm.createTable('incoming_money', {
    id: 'id',
    bank_account_id: {
      type: 'integer',
      notNull: true,
      references: '"bank_accounts"',
      onDelete: 'CASCADE',
    },
    amount: { type: 'numeric(12,2)', notNull: true },
    description: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('incoming_money', 'bank_account_id');
};

exports.down = (pgm) => {
  pgm.dropTable('incoming_money');
};
