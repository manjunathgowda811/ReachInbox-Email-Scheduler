import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Worker, QueueEvents } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { QUEUE_NAMES, EmailJobPayload } from '@reachinbox/shared';
import { createEmailProcessor } from './processors/emailProcessor';
import { processOutboxEvents } from './services/esIndexer';
import { logger } from './services/logger';

// ─── Validate required env ────────────────────────────────────────────────────
const {
  DATABASE_URL,
  REDIS_URL = 'redis://localhost:6379',
  ELASTICSEARCH_URL = 'http://localhost:9200',
  WORKER_CONCURRENCY = '5',
} = process.env;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL is required');
  process.exit(1);
}

// ─── Initialize clients ───────────────────────────────────────────────────────
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

const es = new ElasticClient({ node: ELASTICSEARCH_URL });

const concurrency = Math.max(1, parseInt(WORKER_CONCURRENCY, 10));

// ─── Create Worker ────────────────────────────────────────────────────────────
const emailProcessor = createEmailProcessor(prisma, redis, es);

const worker = new Worker<EmailJobPayload>(
  QUEUE_NAMES.EMAIL_SEND,
  emailProcessor,
  {
    connection: redis,
    concurrency,
    // Lock duration: prevents other workers from picking up the job while processing
    lockDuration: 30000, // 30s
    lockRenewTime: 15000, // Renew lock every 15s for long sends
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  }
);

// ─── Worker Events ────────────────────────────────────────────────────────────
worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id, emailJobId: job.data.emailJobId });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    emailJobId: job?.data?.emailJobId,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

worker.on('stalled', (jobId) => {
  logger.warn('Job stalled — will be retried', { jobId });
});

worker.on('error', (err) => {
  logger.error('Worker error', { err: err.message });
});

// ─── Startup Recovery ─────────────────────────────────────────────────────────
// Reconcile jobs that are stuck in PROCESSING state (process crash between
// SMTP send and DB update). These represent "uncertain delivery" — we mark
// them as FAILED with a specific message rather than blindly retrying.
// This prevents potential duplicate email delivery.
async function recoverUncertainJobs(): Promise<void> {
  const UNCERTAIN_THRESHOLD_MINUTES = 15;
  const cutoff = new Date(Date.now() - UNCERTAIN_THRESHOLD_MINUTES * 60 * 1000);

  const stuckJobs = await prisma.emailJob.findMany({
    where: {
      status: 'PROCESSING',
      processedAt: { lt: cutoff },
    },
  });

  if (stuckJobs.length > 0) {
    logger.warn(`Found ${stuckJobs.length} stuck jobs — marking as uncertain delivery`, {
      count: stuckJobs.length,
    });

    for (const job of stuckJobs) {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError:
            'UNCERTAIN_DELIVERY: Worker crashed between SMTP send and DB update. ' +
            'Email may or may not have been delivered. Manual review required.',
          failedAt: new Date(),
        },
      });

      await prisma.deliveryAttempt.create({
        data: {
          emailJobId: job.id,
          attemptNum: job.attemptCount,
          status: 'uncertain',
          error: 'Process crash during send — delivery state unknown',
        },
      });
    }
  }
}

// ─── Outbox Processor ────────────────────────────────────────────────────────
// Runs every 10 seconds to flush pending ES outbox events
let outboxInterval: ReturnType<typeof setInterval>;

async function startOutboxProcessor(): Promise<void> {
  outboxInterval = setInterval(async () => {
    try {
      await processOutboxEvents(es, prisma);
    } catch (err) {
      logger.error('Outbox processor error', { err: (err as Error).message });
    }
  }, 10000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info('Worker starting', { concurrency, queue: QUEUE_NAMES.EMAIL_SEND });

  // Test DB connection
  await prisma.$connect();
  logger.info('Database connected');

  // Recover uncertain deliveries from previous crash
  await recoverUncertainJobs();

  // Start Elasticsearch outbox processor
  startOutboxProcessor();

  logger.info('Worker ready', {
    concurrency,
    queue: QUEUE_NAMES.EMAIL_SEND,
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down worker gracefully…`);

  clearInterval(outboxInterval);

  // Stop accepting new jobs, wait for current jobs to complete
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

main().catch((err) => {
  logger.error('Worker startup failed', { err: err.message });
  process.exit(1);
});
