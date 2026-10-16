import { Job, DelayedError } from 'bullmq';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import {
  EmailJobPayload,
  getCurrentHourWindowKey,
  getNextHourStart,
  REDIS_KEYS,
} from '@reachinbox/shared';
import { decrypt } from '../services/encryption';
import { logger } from '../services/logger';
import { notifySlackRateLimit } from '../services/slackNotifier';
import { indexEmailJob } from '../services/esIndexer';

const EMAIL_INDEX = 'reachinbox_emails';

// Cache SMTP transports per sender to reuse connections
const transportCache = new Map<string, Transporter>();

async function getOrCreateTransport(
  senderId: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPassEncrypted: string
): Promise<Transporter> {
  if (transportCache.has(senderId)) {
    return transportCache.get(senderId)!;
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: decrypt(smtpPassEncrypted),
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });

  transportCache.set(senderId, transport);
  return transport;
}

/**
 * Rate limit check and reservation using Redis atomic Lua script.
 *
 * Algorithm:
 * 1. Compute the current UTC hour window key: YYYY-MM-DD:HH
 * 2. Use INCR to atomically increment the counter for this sender+window
 * 3. Set TTL of 3700s (slightly over 1 hour) on first increment
 * 4. If counter <= limit -> send is allowed
 * 5. If counter > limit -> deny, return delay until next hour
 */
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, ttl)
end
return current
`;

interface RateLimitResult {
  allowed: boolean;
  current: number;
  delayUntil?: Date;
}

async function checkAndIncrementRateLimit(
  redis: IORedis,
  senderId: string,
  limit: number
): Promise<RateLimitResult> {
  const windowKey = getCurrentHourWindowKey();
  const redisKey = REDIS_KEYS.rateLimitCounter(senderId, windowKey);
  const ttl = 3700; // Slightly over 1 hour to ensure window cleanup

  const current = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    redisKey,
    String(limit),
    String(ttl)
  )) as number;

  if (current <= limit) {
    return { allowed: true, current };
  }

  // Decrement since we over-incremented
  await redis.decr(redisKey);
  const delayUntil = getNextHourStart();
  return { allowed: false, current: current - 1, delayUntil };
}

/**
 * Enforce minimum delay between emails from the same sender
 * using a Redis GETSET pattern.
 */
async function enforceMinDelay(
  redis: IORedis,
  senderId: string,
  minDelayMs: number
): Promise<void> {
  if (minDelayMs <= 0) return;

  const key = REDIS_KEYS.lastSendTime(senderId);
  const lastSendStr = await redis.get(key);

  if (lastSendStr) {
    const lastSend = parseInt(lastSendStr, 10);
    const elapsed = Date.now() - lastSend;
    const remaining = minDelayMs - elapsed;

    if (remaining > 0) {
      logger.debug(`Enforcing min delay: waiting ${remaining}ms for sender ${senderId}`);
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}

async function markLastSend(redis: IORedis, senderId: string): Promise<void> {
  const key = REDIS_KEYS.lastSendTime(senderId);
  await redis.set(key, String(Date.now()), 'EX', 7200); // 2h TTL
}

// ─── Main Processor ───────────────────────────────────────────────────────────

export function createEmailProcessor(
  prisma: PrismaClient,
  redis: IORedis,
  es: ElasticClient
) {
  return async function processEmail(job: Job<EmailJobPayload>): Promise<void> {
    const { emailJobId, senderId, userId, recipientEmail, subject, body } = job.data;
    const startTime = Date.now();

    logger.info('Processing email job', { jobId: job.id, emailJobId, recipientEmail });

    // ─── 1. Load email job from DB ────────────────────────────────────────
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
    });

    if (!emailJob) {
      logger.warn('Email job not found in DB, skipping', { emailJobId });
      return;
    }

    // Idempotency: skip if already sent
    if (emailJob.status === 'SENT' || emailJob.status === 'CANCELLED') {
      logger.info('Email job already processed, skipping', {
        emailJobId,
        status: emailJob.status,
      });
      return;
    }

    // ─── 2. Load sender config ────────────────────────────────────────────
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender || !sender.isActive) {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'FAILED', failedAt: new Date(), lastError: 'Sender not found or inactive' },
      });
      return;
    }

    // ─── 3. Rate limit check ──────────────────────────────────────────────
    const rateLimit = await checkAndIncrementRateLimit(
      redis,
      senderId,
      sender.maxEmailsPerHour
    );

    if (!rateLimit.allowed) {
      // Reschedule to next hour — do NOT fail the job
      const nextHour = getNextHourStart();

      logger.info('Rate limit reached, rescheduling', {
        senderId,
        emailJobId,
        nextHour: nextHour.toISOString(),
      });

      // Mark in DB as rate-limited
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'RATE_LIMITED',
          scheduledAt: nextHour,
        },
      });

      // Get count of remaining queued jobs
      const queuedCount = await prisma.emailJob.count({
        where: {
          senderId,
          status: { in: ['SCHEDULED', 'RATE_LIMITED', 'PENDING'] },
        },
      });

      // Send Slack notification (deduplicated per window)
      await notifySlackRateLimit(
        userId,
        senderId,
        sender.email,
        sender.maxEmailsPerHour,
        queuedCount,
        prisma
      );

      // Reschedule BullMQ job for next hour with a small spread
      const spreadMs = Math.floor(Math.random() * 60000);
      const rescheduleAt = new Date(nextHour.getTime() + spreadMs);

      // In BullMQ, moveToDelayed requires job.token in processor, then throw DelayedError
      if (job.token) {
        await job.moveToDelayed(rescheduleAt.getTime(), job.token);
      } else {
        await job.moveToDelayed(rescheduleAt.getTime());
      }
      throw new DelayedError();
    }

    // ─── 4. Enforce min delay between sends ───────────────────────────────
    await enforceMinDelay(redis, senderId, sender.minDelayMs);

    // ─── 5. Mark job as processing (atomic state transition) ──────────────
    const updated = await prisma.emailJob.updateMany({
      where: { id: emailJobId, status: { notIn: ['SENT', 'CANCELLED', 'PROCESSING'] } },
      data: { status: 'PROCESSING', processedAt: new Date(), attemptCount: { increment: 1 } },
    });

    if (updated.count === 0) {
      // Another worker grabbed it — skip
      logger.warn('Concurrent processing detected, skipping', { emailJobId });
      // Decrement rate limit since we won't send
      const windowKey = getCurrentHourWindowKey();
      await redis.decr(REDIS_KEYS.rateLimitCounter(senderId, windowKey));
      return;
    }

    // ─── 6. Get SMTP transport ────────────────────────────────────────────
    const transport = await getOrCreateTransport(
      senderId,
      sender.smtpHost,
      sender.smtpPort,
      sender.smtpUser,
      sender.smtpPassEncrypted
    );

    // ─── 7. Send email ────────────────────────────────────────────────────
    let messageId: string | undefined;
    let previewUrl: string | undefined;
    let sendError: string | undefined;
    let sendSucceeded = false;

    try {
      const info = await transport.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to: recipientEmail,
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''), // Plain-text fallback
      });

      messageId = info.messageId;
      // Ethereal preview URL
      const etherealUrl = nodemailer.getTestMessageUrl(info);
      if (etherealUrl) previewUrl = etherealUrl as string;

      sendSucceeded = true;
      logger.info('Email sent successfully', {
        emailJobId,
        recipientEmail,
        messageId,
        previewUrl,
      });
    } catch (err) {
      sendError = (err as Error).message;
      logger.error('SMTP send failed', {
        emailJobId,
        recipientEmail,
        error: sendError,
      });
      // Remove cached transport so it gets recreated fresh next time
      transportCache.delete(senderId);
    }

    // ─── 8. Update last send timestamp in Redis ───────────────────────────
    if (sendSucceeded) {
      await markLastSend(redis, senderId);
    } else {
      // Decrement rate limit reservation since send failed
      const windowKey = getCurrentHourWindowKey();
      await redis.decr(REDIS_KEYS.rateLimitCounter(senderId, windowKey));
    }

    const durationMs = Date.now() - startTime;

    // ─── 9. Persist status in DB ──────────────────────────────────────────
    if (sendSucceeded) {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId,
          etherealPreviewUrl: previewUrl ?? null,
          lastError: null,
        },
      });

      await prisma.emailSchedule.update({
        where: { id: emailJob.scheduleId },
        data: { sentCount: { increment: 1 } },
      });
    } else {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lastError: sendError,
        },
      });

      await prisma.emailSchedule.update({
        where: { id: emailJob.scheduleId },
        data: { failedCount: { increment: 1 } },
      });
    }

    // ─── 10. Record delivery attempt (audit trail) ────────────────────────
    try {
      await prisma.deliveryAttempt.create({
        data: {
          emailJobId,
          attemptNum: job.attemptsMade,
          status: sendSucceeded ? 'success' : 'failed',
          error: sendError ?? null,
          messageId: messageId ?? null,
          previewUrl: previewUrl ?? null,
          durationMs,
        },
      });
    } catch (err) {
      logger.warn('Delivery attempt creation failed', { err: (err as Error).message });
    }

    // ─── 11. Create outbox event for ES indexing ──────────────────────────
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateId: emailJobId,
          aggregateType: 'EmailJob',
          eventType: sendSucceeded ? 'sent' : 'failed',
          payload: {
            emailJobId,
            status: sendSucceeded ? 'SENT' : 'FAILED',
            sentAt: sendSucceeded ? new Date().toISOString() : null,
            etherealPreviewUrl: previewUrl ?? null,
          },
        },
      });
    } catch (err) {
      logger.warn('Outbox event creation failed', { err: (err as Error).message });
    }

    // ─── 12. Check if schedule is complete ────────────────────────────────
    const remaining = await prisma.emailJob.count({
      where: {
        scheduleId: emailJob.scheduleId,
        status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
    });

    if (remaining === 0) {
      await prisma.emailSchedule.update({
        where: { id: emailJob.scheduleId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      logger.info('Schedule completed', { scheduleId: emailJob.scheduleId });
    }

    // If send failed, throw now so BullMQ applies retry backoff
    if (!sendSucceeded) {
      throw new Error(sendError ?? 'Send failed');
    }
  };
}
