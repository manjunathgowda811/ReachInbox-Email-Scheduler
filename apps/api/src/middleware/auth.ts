import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req.user as any)?.id || req.session?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (!req.user) {
    try {
      const { prisma } = await import('../config/prisma');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatarUrl: true },
      });
      if (!user) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      req.user = user;
    } catch {
      sendError(res, 'Authentication required', 401);
      return;
    }
  }

  if (req.session && !req.session.userId) {
    req.session.userId = userId;
  }

  next();
}

export function requireBullBoardAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Authentication required');
    return;
  }
  const base64 = authHeader.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf8');
  const [username, password] = decoded.split(':');

  const { env } = require('../config/env');
  if (username !== env.BULL_BOARD_USERNAME || password !== env.BULL_BOARD_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Invalid credentials');
    return;
  }
  next();
}
