import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

// Used to keep login's response time constant whether or not the email
// exists, so timing can't be used to enumerate registered accounts.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

function validateCredentials(body: any): string[] {
  const errors: string[] = [];

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    errors.push('email is required');
  } else if (!EMAIL_RE.test(email)) {
    errors.push('email must be a valid email address');
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    errors.push('password is required');
  } else if (password.length < 8) {
    errors.push('password must be at least 8 characters');
  }

  return errors;
}

// POST /auth/register
router.post('/register', async (req, res) => {
  const errors = validateCredentials(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password as string;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Failed to register user', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const errors = validateCredentials(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password as string;

  try {
    const result = await pool.query('SELECT id, email, password, created_at FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, created_at: user.created_at } });
  } catch (err) {
    console.error('Failed to log in', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch current user', err);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

export default router;
