/**
 * Authentication middleware (dev mode)
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@shelby-rag/shared';
import { db } from '../services/database';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Require authenticated user
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check header (for CLI/API clients)
    const headerUser = req.header('x-user-id');
    
    // Check signed cookie (for web clients)
    const cookieUser = (req as any).signedCookies?.uid;
    
    const userId = headerUser || cookieUser;

    if (!userId) {
      throw new UnauthorizedError('No authentication provided');
    }

    // Verify user exists in database
    const user = await db.getUser(userId);
    if (!user) {
      throw new UnauthorizedError('Invalid user ID');
    }

    // Attach to request
    req.userId = userId;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
}

/**
 * Dev login endpoint
 */
export async function devLogin(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Get or create user
    let user = await db.getUserByEmail(email);
    
    if (!user) {
      user = await db.createUser(email);
      console.log(`👤 New user created: ${user.user_id} (${email})`);
    } else {
      console.log(`👤 User login: ${user.user_id} (${email})`);
    }

    // Set signed cookie
    res.cookie('uid', user.user_id, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      user_id: user.user_id,
      email: user.email,
    });
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

