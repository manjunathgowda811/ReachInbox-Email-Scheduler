import { prisma } from '../../config/prisma';
import { decrypt } from '../../utils/encryption';
import { getCurrentHourWindowKey, REDIS_KEYS } from '@reachinbox/shared';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../utils/logger';
import axios from 'axios';

/**
 * Sends a Slack notification when a sender hits its hourly rate limit.
 * Uses the NotificationEvent table for per-sender-per-window deduplication.
 * Failures are logged but do not propagate — email processing continues.
 */
export async function notifySlackRateLimit(
  userId: string,
  senderId: string,
  senderEmail: string,
  limit: number,
  queuedCount: number
): Promise<void> {
  const windowKey = getCurrentHourWindowKey();

  // Deduplication: only notify once per sender per UTC hour
  try {
    await prisma.notificationEvent.create({
      data: {
        userId,
        senderId,
        eventType: 'rate_limit_reached',
        windowKey,
      },
    });
  } catch (err) {
    // Unique constraint violation = already notified this window
    logger.debug('Slack notification already sent for this window', {
      senderId,
      windowKey,
    });
    return;
  }

  // Fetch Slack integration for this user
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: { isActive: true, webhookUrlEncrypted: true, accessTokenEncrypted: true, channelId: true },
  });

  if (!integration || !integration.isActive) {
    logger.debug('Slack not connected — skipping notification', { userId });
    return;
  }

  const now = new Date();
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ ReachInbox: Hourly Send Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sender:*\n${senderEmail}` },
          { type: 'mrkdwn', text: `*Hourly Limit:*\n${limit} emails` },
          { type: 'mrkdwn', text: `*Window (UTC):*\n${windowKey}` },
          { type: 'mrkdwn', text: `*Time:*\n${now.toUTCString()}` },
          { type: 'mrkdwn', text: `*Queued Remaining:*\n${queuedCount} emails` },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Remaining emails will be automatically rescheduled to the next quota window.',
          },
        ],
      },
    ],
  };

  try {
    if (integration.webhookUrlEncrypted) {
      // Use incoming webhook
      const webhookUrl = decrypt(integration.webhookUrlEncrypted);
      await axios.post(webhookUrl, message);
    } else if (integration.accessTokenEncrypted && integration.channelId) {
      // Use Slack Web API chat.postMessage
      const token = decrypt(integration.accessTokenEncrypted);
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel: integration.channelId, ...message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else {
      logger.warn('No Slack delivery method available', { userId });
      return;
    }

    logger.info('Slack rate-limit notification sent', { senderId, windowKey });
  } catch (err) {
    // Slack failure must not crash worker or lose email jobs
    logger.error('Failed to send Slack notification', {
      err: (err as Error).message,
      senderId,
    });
  }
}
