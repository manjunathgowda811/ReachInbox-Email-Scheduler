import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendError } from '../../utils/response';
import { encrypt, decrypt } from '../../utils/encryption';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

const router = Router();
router.use(requireAuth);

const createSenderSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  maxEmailsPerHour: z.coerce.number().min(1).max(10000).default(200),
  minDelayMs: z.coerce.number().min(0).max(60000).default(2000),
  isEthereal: z.boolean().default(true),
});

/**
 * GET /api/v1/senders
 */
router.get('/', async (req: Request, res: Response) => {
  const senders = await prisma.sender.findMany({
    where: { userId: req.user!.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      smtpHost: true,
      smtpPort: true,
      maxEmailsPerHour: true,
      minDelayMs: true,
      isEthereal: true,
      isActive: true,
      createdAt: true,
    },
  });
  sendSuccess(res, senders);
});

/**
 * POST /api/v1/senders
 * Creates a sender. If isEthereal=true, auto-generates Ethereal SMTP credentials.
 */
router.post('/', async (req: Request, res: Response) => {
  const body = createSenderSchema.parse(req.body);

  let smtpHost = body.smtpHost;
  let smtpPort = body.smtpPort;
  let smtpUser = body.smtpUser;
  let smtpPass = body.smtpPass;

  if (body.isEthereal) {
    // Use env-provided or auto-generate Ethereal credentials
    if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
      smtpHost = 'smtp.ethereal.email';
      smtpPort = 587;
      smtpUser = env.ETHEREAL_USER;
      smtpPass = env.ETHEREAL_PASS;
    } else {
      // Auto-generate a new Ethereal test account
      const testAccount = await nodemailer.createTestAccount();
      smtpHost = testAccount.smtp.host;
      smtpPort = testAccount.smtp.port;
      smtpUser = testAccount.user;
      smtpPass = testAccount.pass;
      logger.info('Created new Ethereal test account', { user: smtpUser });
    }
  }

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return sendError(
      res,
      'SMTP credentials required for non-Ethereal senders',
      400
    );
  }

  const sender = await prisma.sender.create({
    data: {
      userId: req.user!.id,
      name: body.name,
      email: body.email,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassEncrypted: encrypt(smtpPass),
      maxEmailsPerHour: body.maxEmailsPerHour,
      minDelayMs: body.minDelayMs,
      isEthereal: body.isEthereal,
    },
    select: {
      id: true,
      name: true,
      email: true,
      smtpHost: true,
      smtpPort: true,
      maxEmailsPerHour: true,
      minDelayMs: true,
      isEthereal: true,
      isActive: true,
      createdAt: true,
    },
  });

  sendCreated(res, sender);
});

/**
 * PATCH /api/v1/senders/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const sender = await prisma.sender.findUnique({ where: { id: req.params.id } });
  if (!sender) throw new NotFoundError('Sender');
  if (sender.userId !== req.user!.id) throw new ForbiddenError();

  const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    maxEmailsPerHour: z.coerce.number().min(1).max(10000).optional(),
    minDelayMs: z.coerce.number().min(0).max(60000).optional(),
  });

  const body = updateSchema.parse(req.body);
  const updated = await prisma.sender.update({
    where: { id: req.params.id },
    data: body,
    select: {
      id: true,
      name: true,
      email: true,
      smtpHost: true,
      smtpPort: true,
      maxEmailsPerHour: true,
      minDelayMs: true,
      isEthereal: true,
      isActive: true,
      createdAt: true,
    },
  });

  sendSuccess(res, updated);
});

/**
 * DELETE /api/v1/senders/:id
 * Soft-deletes (marks inactive).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const sender = await prisma.sender.findUnique({ where: { id: req.params.id } });
  if (!sender) throw new NotFoundError('Sender');
  if (sender.userId !== req.user!.id) throw new ForbiddenError();

  await prisma.sender.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });

  sendSuccess(res, { message: 'Sender deactivated' });
});

export { router as sendersRouter };
export { decrypt }; // Re-export for worker use
