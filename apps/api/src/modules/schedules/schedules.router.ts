import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendError, parsePagination, paginationMeta } from '../../utils/response';
import { scheduleEmailJob, cancelEmailJob } from '../../queues/emailQueue';
import { parseEmailFile } from '../../utils/csvParser';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import multer from 'multer';
import { EmailJobStatus } from '@reachinbox/shared';

const router = Router();
router.use(requireAuth);

// Multer: in-memory storage, size limit from env
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'text/plain', 'application/csv', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and text files are allowed'));
    }
  },
});

// ─── Parse recipients from uploaded file ──────────────────────────────────────

/**
 * POST /api/v1/schedules/parse
 * Parses an uploaded file and returns recipient count without creating a schedule.
 */
router.post('/parse', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return sendError(res, 'No file uploaded', 400);

  const content = req.file.buffer.toString('utf-8');
  const result = parseEmailFile(content);

  if (result.valid.length > env.MAX_RECIPIENTS_PER_SCHEDULE) {
    return sendError(
      res,
      `Exceeds maximum recipient limit of ${env.MAX_RECIPIENTS_PER_SCHEDULE}`,
      400
    );
  }

  sendSuccess(res, {
    validCount: result.valid.length,
    invalidCount: result.invalid.length,
    duplicates: result.duplicates,
    total: result.total,
    sample: result.valid.slice(0, 5), // Preview of first 5
    invalidSample: result.invalid.slice(0, 5),
  });
});

// ─── Create Schedule ──────────────────────────────────────────────────────────

const createScheduleSchema = z.object({
  senderId: z.string().min(1),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100000),
  startAt: z.string().datetime(),
  recipients: z.array(z.string().email()).min(1).max(10000).optional(),
});

/**
 * POST /api/v1/schedules
 * Creates a schedule with all recipients and enqueues BullMQ delayed jobs.
 * Accepts recipients from JSON body OR file upload.
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  let rawRecipients = req.body.recipients;
  if (typeof rawRecipients === 'string') {
    try {
      rawRecipients = JSON.parse(rawRecipients);
    } catch {
      rawRecipients = [rawRecipients];
    }
  }

  let body: z.infer<typeof createScheduleSchema>;
  try {
    body = createScheduleSchema.parse({
      ...req.body,
      recipients: rawRecipients,
    });
  } catch (err) {
    logger.error('Schedule validation error', { err: (err as Error).message });
    return sendError(
      res,
      'Invalid request body: ' + ((err as z.ZodError).issues?.[0]?.message || 'validation failed'),
      400
    );
  }

  // Resolve recipients from uploaded file or JSON
  let recipients: string[] = body.recipients ?? [];

  if (req.file) {
    const content = req.file.buffer.toString('utf-8');
    const parsed = parseEmailFile(content);
    recipients = parsed.valid;

    if (parsed.valid.length === 0) {
      return sendError(res, 'No valid email addresses found in uploaded file', 400);
    }
  }

  if (recipients.length === 0) {
    return sendError(res, 'No recipients provided', 400);
  }

  if (recipients.length > env.MAX_RECIPIENTS_PER_SCHEDULE) {
    return sendError(
      res,
      `Exceeds maximum ${env.MAX_RECIPIENTS_PER_SCHEDULE} recipients`,
      400
    );
  }

  // Verify sender ownership
  const sender = await prisma.sender.findFirst({
    where: { id: body.senderId, userId: req.user!.id, isActive: true },
  });

  if (!sender) throw new NotFoundError('Sender');

  let startAt = new Date(body.startAt);
  if (startAt.getTime() < Date.now() - 60000) {
    return sendError(res, 'Start time cannot be in the past', 400);
  }
  if (startAt.getTime() < Date.now()) {
    startAt = new Date();
  }

  // Deduplicate recipients
  const uniqueRecipients = [...new Set(recipients.map((e) => e.toLowerCase()))];

  // Create schedule and all email jobs in a transaction
  const schedule = await prisma.$transaction(async (tx) => {
    const newSchedule = await tx.emailSchedule.create({
      data: {
        userId: req.user!.id,
        senderId: sender.id,
        subject: body.subject,
        body: body.body,
        startAt,
        totalRecipients: uniqueRecipients.length,
        status: 'SCHEDULED',
      },
    });

    // Create email job records
    const emailJobData = uniqueRecipients.map((email, index) => ({
      scheduleId: newSchedule.id,
      senderId: sender.id,
      userId: req.user!.id,
      recipientEmail: email,
      subject: body.subject,
      body: body.body,
      status: 'SCHEDULED' as EmailJobStatus,
      // Stagger scheduled times: startAt + index * minDelayMs
      scheduledAt: new Date(
        startAt.getTime() + index * sender.minDelayMs
      ),
      sequenceIndex: index,
    }));

    await tx.emailJob.createMany({ data: emailJobData });

    return newSchedule;
  });

  // Fetch created jobs to enqueue and record outbox events with their actual IDs
  const emailJobs = await prisma.emailJob.findMany({
    where: { scheduleId: schedule.id },
    orderBy: { sequenceIndex: 'asc' },
  });

  const outboxData = emailJobs.map((job) => ({
    aggregateId: job.id,
    aggregateType: 'EmailJob',
    eventType: 'created',
    payload: JSON.stringify({ emailJobId: job.id, scheduleId: schedule.id }),
  }));
  try {
    await prisma.outboxEvent.createMany({ data: outboxData as any });
  } catch (err) {
    logger.warn('Outbox event recording notice', { err: (err as Error).message });
  }

  let enqueuedCount = 0;

  if (env.SHOWCASE_MODE) {
    // In Showcase Mode: the local database-backed scheduler processes jobs
    for (const job of emailJobs) {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId: `showcase:${job.id}` },
      });
      enqueuedCount++;
    }
  } else {
    // In Full Assignment Mode: enqueue BullMQ delayed jobs backed by Redis
    for (const job of emailJobs) {
      try {
        const bullJobId = await scheduleEmailJob(
          job.id,
          {
            emailJobId: job.id,
            scheduleId: schedule.id,
            senderId: sender.id,
            userId: req.user!.id,
            recipientEmail: job.recipientEmail,
            subject: job.subject,
            body: job.body,
            attemptNumber: 0,
          },
          job.scheduledAt
        );

        await prisma.emailJob.update({
          where: { id: job.id },
          data: { bullJobId },
        });

        enqueuedCount++;
      } catch (err) {
        logger.error('Failed to enqueue job', {
          emailJobId: job.id,
          error: (err as Error).message,
        });
      }
    }
  }

  logger.info('Schedule created', {
    scheduleId: schedule.id,
    recipients: uniqueRecipients.length,
    enqueued: enqueuedCount,
    mode: env.SHOWCASE_MODE ? 'showcase' : 'full',
  });

  sendCreated(res, {
    scheduleId: schedule.id,
    totalRecipients: uniqueRecipients.length,
    enqueuedJobs: enqueuedCount,
    startAt: startAt.toISOString(),
  });
});

// ─── Get Schedules ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/schedules
 */
router.get('/', async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);

  const [schedules, total] = await Promise.all([
    prisma.emailSchedule.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        sender: { select: { name: true, email: true } },
        _count: { select: { emailJobs: true } },
      },
    }),
    prisma.emailSchedule.count({ where: { userId: req.user!.id } }),
  ]);

  sendSuccess(res, schedules, 200, paginationMeta(total, page, limit));
});

/**
 * GET /api/v1/schedules/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  const schedule = await prisma.emailSchedule.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { sender: { select: { name: true, email: true } } },
  });

  if (!schedule) throw new NotFoundError('Schedule');
  sendSuccess(res, schedule);
});

/**
 * POST /api/v1/schedules/:id/cancel
 * Cancels a schedule: marks jobs CANCELLED and removes from queue.
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const schedule = await prisma.emailSchedule.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });

  if (!schedule) throw new NotFoundError('Schedule');
  if (['COMPLETED', 'CANCELLED'].includes(schedule.status)) {
    return sendError(res, 'Cannot cancel a completed or already cancelled schedule', 400);
  }

  // Cancel all pending/scheduled jobs
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      scheduleId: schedule.id,
      status: { in: ['PENDING', 'SCHEDULED'] },
    },
    select: { id: true, bullJobId: true },
  });

  for (const job of pendingJobs) {
    try {
      await cancelEmailJob(job.id);
    } catch (err) {
      logger.warn('Failed to cancel queue job', { jobId: job.bullJobId });
    }
  }

  await prisma.$transaction([
    prisma.emailJob.updateMany({
      where: {
        scheduleId: schedule.id,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      data: { status: 'CANCELLED' },
    }),
    prisma.emailSchedule.update({
      where: { id: schedule.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    }),
  ]);

  sendSuccess(res, { message: 'Schedule cancelled', cancelledJobs: pendingJobs.length });
});

export { router as schedulesRouter };
