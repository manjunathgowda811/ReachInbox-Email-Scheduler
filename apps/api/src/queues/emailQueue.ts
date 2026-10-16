import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { QUEUE_NAMES, EmailJobPayload } from '@reachinbox/shared';
import { logger } from '../utils/logger';

let emailQueue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue(): Queue<EmailJobPayload> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobPayload>(QUEUE_NAMES.EMAIL_SEND, {
      connection: getRedisClient(),
      defaultJobOptions: {
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24h for Bull Board visibility
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      logger.error('Email queue error', { err: err.message });
    });
  }
  return emailQueue;
}

/**
 * Schedule a BullMQ delayed email job.
 * Uses a deterministic job ID: `email:{emailJobId}` to prevent duplicates.
 */
export async function scheduleEmailJob(
  emailJobId: string,
  payload: EmailJobPayload,
  executeAt: Date
): Promise<string> {
  const queue = getEmailQueue();
  const delay = Math.max(0, executeAt.getTime() - Date.now());
  const jobId = `email:${emailJobId}`;

  // Check if job already exists to prevent duplicates
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    logger.debug('Job already exists, skipping', { jobId });
    return jobId;
  }

  await queue.add(QUEUE_NAMES.EMAIL_SEND, payload, {
    jobId,
    delay,
    priority: 10,
  });

  logger.debug('Scheduled email job', {
    jobId,
    emailJobId,
    executeAt: executeAt.toISOString(),
    delayMs: delay,
  });

  return jobId;
}

export async function cancelEmailJob(emailJobId: string): Promise<void> {
  const queue = getEmailQueue();
  const jobId = `email:${emailJobId}`;
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info('Cancelled email job', { jobId });
  }
}
