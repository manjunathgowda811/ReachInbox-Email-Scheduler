import { Client } from '@elastic/elasticsearch';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const EMAIL_INDEX = 'reachinbox_emails';

/**
 * Index a single email job in Elasticsearch.
 * Called after successful send or status change.
 * Failures are logged but do not fail the email send.
 */
export async function indexEmailJob(
  es: Client,
  prisma: PrismaClient,
  emailJobId: string
): Promise<void> {
  try {
    const job = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: { sender: { select: { name: true, email: true } } },
    });

    if (!job) return;

    await es.index({
      index: EMAIL_INDEX,
      id: emailJobId,
      document: {
        id: job.id,
        scheduleId: job.scheduleId,
        userId: job.userId,
        senderId: job.senderId,
        senderEmail: job.sender.email,
        senderName: job.sender.name,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body.substring(0, 1000), // Truncate for ES storage
        status: job.status,
        scheduledAt: job.scheduledAt,
        sentAt: job.sentAt,
        failedAt: job.failedAt,
        attemptCount: job.attemptCount,
        etherealPreviewUrl: job.etherealPreviewUrl,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      refresh: false, // Async refresh for performance
    });

    logger.debug('Indexed email job in ES', { emailJobId });
  } catch (err) {
    logger.error('ES indexing failed (non-fatal)', {
      emailJobId,
      err: (err as Error).message,
    });
    // Re-throw so outbox processor can retry
    throw err;
  }
}

/**
 * Process pending outbox events — indexes them in Elasticsearch.
 * Implements the transactional outbox pattern for reliable ES sync.
 */
export async function processOutboxEvents(
  es: Client,
  prisma: PrismaClient
): Promise<void> {
  const events = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  if (events.length === 0) return;

  for (const event of events) {
    // Mark as processing
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: 'PROCESSING' },
    });

    try {
      await indexEmailJob(es, prisma, event.aggregateId);

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'DONE', processedAt: new Date() },
      });
    } catch (err) {
      const newCount = event.attemptCount + 1;
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: newCount >= 5 ? 'FAILED' : 'PENDING',
          attemptCount: newCount,
          lastError: (err as Error).message,
        },
      });
      logger.warn('Outbox event processing failed', {
        eventId: event.id,
        attempt: newCount,
      });
    }
  }
}
