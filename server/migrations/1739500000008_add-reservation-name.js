exports.up = (pgm) => {
  pgm.addColumn('reservations', {
    name: { type: 'varchar(100)' },
  });

  // Backfill existing rows with a sensible label derived from their purpose.
  pgm.sql(`
    UPDATE reservations SET name = CASE purpose
      WHEN 'credit_card_payment' THEN 'Credit Card Payment'
      WHEN 'bill' THEN 'Bill'
      ELSE 'Other'
    END
    WHERE name IS NULL
  `);

  pgm.alterColumn('reservations', 'name', { notNull: true });
};

exports.down = (pgm) => {
  pgm.dropColumn('reservations', 'name');
};
