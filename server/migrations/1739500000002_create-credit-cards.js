exports.up = (pgm) => {
  pgm.createTable('credit_cards', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(255)', notNull: true },
    bank: { type: 'varchar(255)', notNull: true },
    // Day of month (1-31) the statement balance is due, e.g. 25.
    due_date: { type: 'smallint', notNull: true, check: 'due_date BETWEEN 1 AND 31' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('credit_cards', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('credit_cards');
};
