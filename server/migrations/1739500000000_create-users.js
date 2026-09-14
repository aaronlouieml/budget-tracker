exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Temporary development user so expenses can be created before auth exists.
  pgm.sql(`
    INSERT INTO users (id, email, password)
    VALUES (1, 'dev@example.com', 'dev-user-placeholder')
  `);
  pgm.sql(`SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users))`);
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
