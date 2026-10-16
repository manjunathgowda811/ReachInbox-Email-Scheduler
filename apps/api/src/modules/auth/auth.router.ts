import { Router, Request, Response, NextFunction } from 'express';
import { passport } from './passport';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/v1/auth/google
 * Initiates Google OAuth flow with CSRF state parameter.
 */
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  // Generate CSRF state
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    prompt: 'select_account',
  })(req, res, next);
});

/**
 * GET /api/v1/auth/google/callback
 * Handles Google OAuth callback, validates state, establishes session.
 */
router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    // CSRF state validation
    const returnedState = req.query.state as string;
    const storedState = req.session.oauthState;

    if (!returnedState || returnedState !== storedState) {
      logger.warn('OAuth state mismatch — potential CSRF attack');
      return res.redirect(`${env.WEB_URL}/login?error=state_mismatch`);
    }

    delete req.session.oauthState;

    passport.authenticate('google', {
      failureRedirect: `${env.WEB_URL}/login?error=auth_failed`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    if (req.user) {
      req.session.userId = req.user.id;
      logger.info('Session established', { userId: req.user.id });
    }
    res.redirect(`${env.WEB_URL}/dashboard`);
  }
);

/**
 * POST /api/v1/auth/dev-login
 * Demo / Dev user login for quick evaluation without Google OAuth setup.
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production' && !env.SHOWCASE_MODE) {
    return sendError(res, 'Demo login is disabled in production', 403);
  }

  try {
    const { prisma } = await import('../../config/prisma');
    const demoEmail = req.body?.email || 'oliver.brown@domain.io';
    const demoName = req.body?.name || 'Oliver Brown';

    const user = await prisma.user.upsert({
      where: { email: demoEmail },
      update: { name: demoName },
      create: {
        googleId: `demo-user-oliver-${Date.now()}`,
        email: demoEmail,
        name: demoName,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      },
    });

    // Ensure default sender exists for this demo user
    const existingSender = await prisma.sender.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!existingSender) {
      let smtpUser = 'oliver.brown@domain.io';
      let smtpPass = 'demo-smtp-pass';
      let smtpHost = 'smtp.ethereal.email';
      let smtpPort = 587;

      if (!env.SHOWCASE_MODE) {
        try {
          const nodemailer = (await import('nodemailer')).default;
          const testAccount = await nodemailer.createTestAccount();
          smtpUser = testAccount.user;
          smtpPass = testAccount.pass;
          smtpHost = testAccount.smtp.host;
          smtpPort = testAccount.smtp.port;
        } catch (etherealErr) {
          logger.warn('Could not auto-generate Ethereal account, using local demo sender config', {
            err: (etherealErr as Error).message,
          });
        }
      }

      const { encrypt } = await import('../../utils/encryption');

      await prisma.sender.create({
        data: {
          userId: user.id,
          name: `${user.name} (Demo Sender)`,
          email: smtpUser.includes('@') ? smtpUser : 'oliver.brown@domain.io',
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassEncrypted: encrypt(smtpPass),
          maxEmailsPerHour: 200,
          minDelayMs: 2000,
          isEthereal: true,
        },
      });
    }

    req.session.userId = user.id;
    req.login(user, (err) => {
      if (err) {
        logger.error('Login error', { err: err.message });
        return sendError(res, 'Login failed', 500);
      }
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save error', { err: saveErr.message });
        }
        return sendSuccess(res, {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        });
      });
    });
  } catch (err) {
    logger.error('Dev login error', { err: (err as Error).message });
    return sendError(res, 'Dev login failed', 500);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  sendSuccess(res, {
    id: req.user!.id,
    email: req.user!.email,
    name: req.user!.name,
    avatarUrl: req.user!.avatarUrl,
  });
});

/**
 * POST /api/v1/auth/logout
 * Destroys the session and clears the cookie.
 */
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destroy error', { err: err.message });
      return sendError(res, 'Logout failed', 500);
    }
    res.clearCookie('reachinbox.sid');
    sendSuccess(res, { message: 'Logged out successfully' });
  });
});

export { router as authRouter };

// Extend session with OAuth state
declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
  }
}
