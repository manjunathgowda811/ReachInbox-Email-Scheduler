import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { getElasticsearchClient, EMAIL_INDEX } from '../../config/elasticsearch';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, parsePagination, paginationMeta } from '../../utils/response';
import { NotFoundError } from '../../middleware/errorHandler';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

const router = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * GET /api/v1/emails/:id/preview
 * Renders an HTML preview of the email message with clear simulation notice.
 * Publicly viewable so links open cleanly in new tabs/windows.
 */
router.get('/:id/preview', async (req: Request, res: Response) => {
  const job = await prisma.emailJob.findUnique({
    where: { id: req.params.id },
    include: {
      sender: { select: { name: true, email: true } },
      attempts: { orderBy: { attemptedAt: 'desc' } },
    },
  });

  if (!job) {
    return res.status(404).send('<h3>Email not found</h3>');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Email Preview: ${escapeHtml(job.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .banner { background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e40af; padding: 14px 20px; font-size: 13px; line-height: 1.5; }
    .banner strong { font-weight: 600; color: #1e3a8a; }
    .meta { padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .meta-row { display: flex; margin-bottom: 8px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { width: 110px; color: #64748b; font-weight: 500; }
    .meta-value { color: #0f172a; font-weight: 500; flex: 1; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-sent { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef9c3; color: #854d0e; }
    .badge-failed { background: #fee2e2; color: #b91c1c; }
    .body { padding: 28px 20px; font-size: 14px; line-height: 1.6; color: #334155; }
    .footer { padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="banner">
      <strong>Demo Delivery</strong> — Simulated locally. No external email was sent.
      <div style="font-size: 11px; color: #3b82f6; margin-top: 3px;">Simulated via ReachInbox Local Showcase Engine • Rate limits & pacing enforced</div>
    </div>
    <div class="meta">
      <div class="meta-row"><div class="meta-label">Subject:</div><div class="meta-value">${escapeHtml(job.subject)}</div></div>
      <div class="meta-row"><div class="meta-label">From:</div><div class="meta-value">${escapeHtml(job.sender?.name || 'Sender')} &lt;${escapeHtml(job.sender?.email || '')}&gt;</div></div>
      <div class="meta-row"><div class="meta-label">To:</div><div class="meta-value">${escapeHtml(job.recipientEmail)}</div></div>
      <div class="meta-row"><div class="meta-label">Status:</div><div class="meta-value"><span class="badge ${job.status === 'SENT' ? 'badge-sent' : job.status === 'FAILED' ? 'badge-failed' : 'badge-pending'}">${job.status}</span></div></div>
      <div class="meta-row"><div class="meta-label">Sent At:</div><div class="meta-value">${job.sentAt ? new Date(job.sentAt).toLocaleString() : 'Not sent yet'}</div></div>
      <div class="meta-row"><div class="meta-label">Message ID:</div><div class="meta-value" style="font-family: monospace; font-size: 11px;">${escapeHtml(job.messageId || 'N/A')}</div></div>
    </div>
    <div class="body">
      ${job.body}
    </div>
    <div class="footer">
      ReachInbox Email Scheduler • Local Showcase Mode
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Protect all remaining routes with authentication
router.use(requireAuth);

/**
 * GET /api/v1/emails/scheduled
 * Lists scheduled (pending/scheduled) email jobs for the current user.
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const statusFilter = (req.query.status as string)?.toUpperCase();

  const whereClause = {
    userId: req.user!.id,
    status: statusFilter
      ? { in: [statusFilter] as ('PENDING' | 'SCHEDULED')[] }
      : { in: ['PENDING', 'SCHEDULED'] as ('PENDING' | 'SCHEDULED')[] },
  };

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
      include: {
        sender: { select: { name: true, email: true } },
        schedule: { select: { subject: true } },
      },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  sendSuccess(res, jobs, 200, paginationMeta(total, page, limit));
});

/**
 * GET /api/v1/emails/sent
 * Lists sent/failed email jobs for the current user.
 */
router.get('/sent', async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);

  const whereClause = {
    userId: req.user!.id,
    status: { in: ['SENT', 'FAILED'] as ('SENT' | 'FAILED')[] },
  };

  const [jobs, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        sender: { select: { name: true, email: true } },
      },
    }),
    prisma.emailJob.count({ where: whereClause }),
  ]);

  sendSuccess(res, jobs, 200, paginationMeta(total, page, limit));
});

/**
 * GET /api/v1/emails/search
 * Full-text search via Elasticsearch with Database fallback.
 */
router.get('/search', async (req: Request, res: Response) => {
  const querySchema = z.object({
    q: z.string().optional(),
    status: z.string().optional(),
    senderId: z.string().optional(),
    recipientEmail: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  });

  const params = querySchema.parse(req.query);
  const skip = (params.page - 1) * params.limit;

  const client = getElasticsearchClient();

  try {
    // Build Elasticsearch query
    const must: object[] = [
      { term: { userId: req.user!.id } }, // Tenant isolation — always applied
    ];

    if (params.q) {
      must.push({
        multi_match: {
          query: params.q,
          fields: ['subject', 'recipientEmail', 'senderName'],
          type: 'best_fields',
        },
      });
    }

    if (params.status) must.push({ term: { status: params.status.toUpperCase() } });
    if (params.senderId) must.push({ term: { senderId: params.senderId } });
    if (params.recipientEmail) {
      must.push({ match: { recipientEmail: params.recipientEmail } });
    }

    const dateFilter: Record<string, string> = {};
    if (params.startDate) dateFilter.gte = params.startDate;
    if (params.endDate) dateFilter.lte = params.endDate;
    if (Object.keys(dateFilter).length > 0) {
      must.push({ range: { scheduledAt: dateFilter } });
    }

    const esResult = await client.search({
      index: EMAIL_INDEX,
      from: skip,
      size: params.limit,
      query: { bool: { must } },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = esResult.hits.hits;
    const total =
      typeof esResult.hits.total === 'number'
        ? esResult.hits.total
        : (esResult.hits.total as { value: number }).value;

    sendSuccess(
      res,
      hits.map((h) => h._source),
      200,
      paginationMeta(total, params.page, params.limit)
    );
  } catch (err) {
    // ES unavailable — fall back to Database
    logger.warn('Elasticsearch search failed, falling back to local database', {
      err: (err as Error).message,
    });

    const where: Record<string, unknown> = {
      userId: req.user!.id,
    };

    const isSqlite = env.DATABASE_URL.startsWith('file:');
    const modeObj = isSqlite ? {} : { mode: 'insensitive' as const };

    if (params.q) {
      where.OR = [
        { subject: { contains: params.q, ...modeObj } },
        { recipientEmail: { contains: params.q, ...modeObj } },
      ];
    }

    if (params.status) where.status = params.status.toUpperCase();
    if (params.senderId) where.senderId = params.senderId;
    if (params.recipientEmail) {
      where.recipientEmail = { contains: params.recipientEmail, ...modeObj };
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: params.limit,
        include: { sender: { select: { name: true, email: true } } },
      }),
      prisma.emailJob.count({ where }),
    ]);

    sendSuccess(res, jobs, 200, paginationMeta(total, params.page, params.limit));
  }
});

/**
 * GET /api/v1/emails/:id
 * Returns a single email job with delivery attempts.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const job = await prisma.emailJob.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: {
      sender: { select: { name: true, email: true } },
      attempts: { orderBy: { attemptedAt: 'asc' } },
    },
  });

  if (!job) throw new NotFoundError('Email job');
  sendSuccess(res, job);
});

export { router as emailsRouter };
