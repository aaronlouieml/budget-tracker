import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const JWT_ALGORITHM = 'HS256';

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET as string, { expiresIn: '7d', algorithm: JWT_ALGORITHM });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET as string, { algorithms: [JWT_ALGORITHM] }) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
