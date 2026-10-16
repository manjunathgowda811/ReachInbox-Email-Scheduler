import { PrismaClient } from '@prisma/client';
import { decrypt } from './encryption';
import { logger } from './logger';
import axios from 'axios';
import { getCurrentHourWindowKey } from '@reachinbox/shared';

/**
 * Slack notification service for the worker process.
 * Mirrors apps/api/src/modules/slack/slack.service.ts
 * Failures do NOT propagate.
 */
export async function notifySlackRateLimit(
  userId: string,
  senderId: string,
  senderEmail: string,
  limit: number,
  queuedCount: number,
  prisma?: PrismaClient
): Promise<void> {
  if (!prisma) return;

  const windowKey = getCurrentHourWindowKey();

  // Deduplication via unique DB constraint
  try {
    await prisma.notificationEvent.create({
      data: { userId, senderId, eventType: 'rate_limit_reached', windowKey },
    });
  } catch {
    logger.debug('Slack notification already sent for window', { senderId, windowKey });
    return;
  }

  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: { isActive: true, webhookUrlEncrypted: true, accessTokenEncrypted: true, channelId: true },
  });

  if (!integration?.isActive) return;

  const message = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⚠️ ReachInbox: Hourly Send Limit Reached', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sender:*\n${senderEmail}` },
          { type: 'mrkdwn', text: `*Hourly Limit:*\n${limit} emails` },
          { type: 'mrkdwn', text: `*Window (UTC):*\n${windowKey}` },
          { type: 'mrkdwn', text: `*Queued Remaining:*\n${queuedCount} emails` },
        ],
      },
    ],
  };

  try {
    if (integration.webhookUrlEncrypted) {
      await axios.post(decrypt(integration.webhookUrlEncrypted), message);
      logger.info('Slack rate-limit notification sent via webhook', { senderId });
    } else if (integration.accessTokenEncrypted && integration.channelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel: integration.channelId, ...message },
        { headers: { Authorization: `Bearer ${decrypt(integration.accessTokenEncrypted)}` } }
      );
      logger.info('Slack rate-limit notification sent via API', { senderId });
    }
  } catch (err) {
    logger.error('Slack notification failed (non-fatal)', { err: (err as Error).message });
  }
}
