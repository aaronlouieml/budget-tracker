exports.up = (pgm) => {
  pgm.createTable('bank_accounts', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)', notNull: true },
    type: { type: 'varchar(20)', notNull: true, check: "type IN ('savings', 'checking', 'cash', 'ewallet')" },
    balance: { type: 'numeric(12,2)', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('bank_accounts', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('bank_accounts');
};
