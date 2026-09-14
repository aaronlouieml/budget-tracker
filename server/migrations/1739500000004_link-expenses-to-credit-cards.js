exports.up = (pgm) => {
  // Deleting a card should not delete its expense history, only detach it.
  pgm.addConstraint('expenses', 'expenses_credit_card_id_fkey', {
    foreignKeys: {
      columns: 'credit_card_id',
      references: '"credit_cards"(id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('expenses', 'expenses_credit_card_id_fkey');
};
