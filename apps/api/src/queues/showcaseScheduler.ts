import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { getCurrentHourWindowKey, getNextHourStart } from '@reachinbox/shared';

// Track last send time per sender in memory for minimum inter-email delay throttling
const lastSendMap = new Map<string, number>();

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Starts the persistent database-backed scheduler for Local Showcase Mode.
 *
 * Designed to demonstrate email scheduling, recipient pacing, hourly quota
 * enforcement, crash recovery, and execution state persistence without requiring
 * external Redis or BullMQ processes.
 */
export function startShowcaseScheduler(): { stop: () => void } {
  if (schedulerInterval) {
    logger.warn('[ShowcaseScheduler] Scheduler already running');
    return { stop: stopShowcaseScheduler };
  }

  logger.info('[ShowcaseScheduler] Starting local database-backed scheduler (Showcase Mode)');

  // 1. Crash recovery: reconcile jobs stuck in PROCESSING state from previous runs
  prisma.emailJob
    .updateMany({
      where: { status: 'PROCESSING' },
      data: {
        status: 'SCHEDULED',
      },
    })
    .then((res) => {
      if (res.count > 0) {
        logger.info(`[ShowcaseScheduler] Reconciled ${res.count} jobs left in PROCESSING state after restart`);
      }
    })
    .catch((err) => {
      logger.warn('[ShowcaseScheduler] Startup recovery warning', { err: (err as Error).message });
    });

  // 2. Poll loop: checks for due jobs every 2 seconds (persistent polling, not cron)
  schedulerInterval = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await processDueJobs();
    } catch (err) {
      logger.error('[ShowcaseScheduler] Processing cycle error', {
        err: (err as Error).message,
      });
    } finally {
      isRunning = false;
    }
  }, 2000);

  return { stop: stopShowcaseScheduler };
}

export function stopShowcaseScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[ShowcaseScheduler] Local database-backed scheduler stopped');
  }
}

async function processDueJobs(): Promise<void> {
  const now = new Date();

  // Find due jobs ordered by scheduledAt and sequenceIndex
  const dueJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'RATE_LIMITED', 'PENDING'] },
      scheduledAt: { lte: now },
    },
    orderBy: [
      { scheduledAt: 'asc' },
      { sequenceIndex: 'asc' },
    ],
    take: 10,
    include: {
      sender: true,
      schedule: true,
    },
  });

  if (dueJobs.length === 0) return;

  for (const job of dueJobs) {
    // A. Check if the parent campaign was cancelled
    if (job.schedule?.status === 'CANCELLED') {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      });
      continue;
    }

    // B. Hourly Rate Limiting check
    const windowKey = getCurrentHourWindowKey();
    const hourStart = new Date();
    hourStart.setUTCMinutes(0, 0, 0);
    const hourEnd = getNextHourStart();

    const sentThisHour = await prisma.emailJob.count({
      where: {
        senderId: job.senderId,
        status: 'SENT',
        sentAt: { gte: hourStart, lt: hourEnd },
      },
    });

    if (sentThisHour >= job.sender.maxEmailsPerHour) {
      const nextHour = getNextHourStart();
      logger.info(
        `[ShowcaseScheduler] Sender ${job.sender.email} reached hourly limit (${sentThisHour}/${job.sender.maxEmailsPerHour}). Deferring job ${job.id} to ${nextHour.toISOString()}`
      );

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: 'RATE_LIMITED',
          scheduledAt: nextHour,
        },
      });

      // Record simulated Slack notification event (deduplicated per sender and hour)
      const eventWindowKey = `${job.senderId}:${windowKey}`;
      try {
        await prisma.notificationEvent.create({
          data: {
            userId: job.userId,
            senderId: job.senderId,
            eventType: 'rate_limit_reached',
            windowKey: eventWindowKey,
          },
        });
        logger.info(
          `[ShowcaseScheduler] Recorded simulated Slack rate-limit event for ${job.sender.email} (${eventWindowKey})`
        );
      } catch {
        // Deduplication: already notified for this hour window
      }

      continue;
    }

    // C. Minimum Delay check (pacing between consecutive sends)
    const lastSendTime = lastSendMap.get(job.senderId) || 0;
    const elapsed = Date.now() - lastSendTime;
    if (job.sender.minDelayMs > 0 && elapsed < job.sender.minDelayMs) {
      // Delay not satisfied yet; will be picked up on subsequent tick
      continue;
    }

    // D. Atomic transition to PROCESSING
    const locked = await prisma.emailJob.updateMany({
      where: {
        id: job.id,
        status: { in: ['SCHEDULED', 'RATE_LIMITED', 'PENDING'] },
      },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    if (locked.count === 0) continue; // Grabbed by another tick

    lastSendMap.set(job.senderId, Date.now());

    // E. Execute Simulated Delivery
    const previewUrl = `/api/v1/emails/${job.id}/preview`;
    const messageId = `<showcase-${job.id}-${Date.now()}@reachinbox.local>`;
    const durationMs = Math.floor(Math.random() * 50) + 25;

    // Record delivery attempt audit log
    await prisma.deliveryAttempt.create({
      data: {
        emailJobId: job.id,
        attemptNum: job.attemptCount + 1,
        status: 'success',
        messageId,
        previewUrl,
        durationMs,
      },
    });

    // Update EmailJob to SENT
    await prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId,
        etherealPreviewUrl: previewUrl,
        lastError: null,
      },
    });

    // Increment schedule sentCount
    await prisma.emailSchedule.update({
      where: { id: job.scheduleId },
      data: { sentCount: { increment: 1 } },
    });

    // Check if campaign is completed
    const remaining = await prisma.emailJob.count({
      where: {
        scheduleId: job.scheduleId,
        status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
    });

    if (remaining === 0) {
      await prisma.emailSchedule.update({
        where: { id: job.scheduleId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    logger.info(
      `[ShowcaseScheduler] [Demo Delivery] Dispatched email to ${job.recipientEmail} ("${job.subject}")`
    );
  }
}
