import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { encrypt, decrypt } from '../../utils/encryption';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import axios from 'axios';
import crypto from 'crypto';

const router = Router();

// ─── Slack OAuth ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/integrations/slack/connect
 * Initiates Slack OAuth flow.
 */
router.get('/connect', requireAuth, (req: Request, res: Response) => {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CALLBACK_URL) {
    return sendError(res, 'Slack OAuth is not configured', 503);
  }

  const state = crypto.randomBytes(16).toString('hex');
  req.session.slackOAuthState = state;

  const scopes = ['incoming-webhook', 'chat:write', 'chat:write.public'].join(',');
  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  slackAuthUrl.searchParams.set('scope', scopes);
  slackAuthUrl.searchParams.set('redirect_uri', env.SLACK_CALLBACK_URL);
  slackAuthUrl.searchParams.set('state', state);

  res.redirect(slackAuthUrl.toString());
});

/**
 * GET /api/v1/integrations/slack/callback
 * Handles Slack OAuth callback.
 */
router.get('/callback', requireAuth, async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn('Slack OAuth denied', { error });
    return res.redirect(`${env.WEB_URL}/dashboard?slack_error=denied`);
  }

  // CSRF state validation
  if (!state || state !== req.session.slackOAuthState) {
    logger.warn('Slack OAuth state mismatch');
    return res.redirect(`${env.WEB_URL}/dashboard?slack_error=state_mismatch`);
  }
  delete req.session.slackOAuthState;

  if (!code) {
    return res.redirect(`${env.WEB_URL}/dashboard?slack_error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID!,
        client_secret: env.SLACK_CLIENT_SECRET!,
        code: code as string,
        redirect_uri: env.SLACK_CALLBACK_URL!,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const data = tokenResponse.data;
    if (!data.ok) {
      logger.error('Slack token exchange failed', { error: data.error });
      return res.redirect(`${env.WEB_URL}/dashboard?slack_error=token_failed`);
    }

    // Upsert Slack integration
    await prisma.slackIntegration.upsert({
      where: { userId: req.user!.id },
      update: {
        teamId: data.team.id,
        teamName: data.team.name,
        channelId: data.incoming_webhook?.channel_id ?? null,
        channelName: data.incoming_webhook?.channel ?? null,
        accessTokenEncrypted: encrypt(data.access_token),
        webhookUrlEncrypted: data.incoming_webhook?.url
          ? encrypt(data.incoming_webhook.url)
          : null,
        scope: data.scope ?? '',
        botUserId: data.bot_user_id ?? null,
        isActive: true,
      },
      create: {
        userId: req.user!.id,
        teamId: data.team.id,
        teamName: data.team.name,
        channelId: data.incoming_webhook?.channel_id ?? null,
        channelName: data.incoming_webhook?.channel ?? null,
        accessTokenEncrypted: encrypt(data.access_token),
        webhookUrlEncrypted: data.incoming_webhook?.url
          ? encrypt(data.incoming_webhook.url)
          : null,
        scope: data.scope ?? '',
        botUserId: data.bot_user_id ?? null,
        isActive: true,
      },
    });

    logger.info('Slack integration connected', {
      userId: req.user!.id,
      team: data.team.name,
    });

    res.redirect(`${env.WEB_URL}/dashboard?slack_connected=true`);
  } catch (err) {
    logger.error('Slack OAuth callback error', { err: (err as Error).message });
    res.redirect(`${env.WEB_URL}/dashboard?slack_error=server_error`);
  }
});

/**
 * GET /api/v1/integrations/slack/status
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId: req.user!.id },
    select: {
      teamName: true,
      channelName: true,
      isActive: true,
      connectedAt: true,
    },
  });

  if (!integration || !integration.isActive) {
    return sendSuccess(res, { connected: false });
  }

  sendSuccess(res, {
    connected: true,
    teamName: integration.teamName,
    channelName: integration.channelName,
    connectedAt: integration.connectedAt,
  });
});

/**
 * POST /api/v1/integrations/slack/webhook
 * Connects Slack using a direct Incoming Webhook URL.
 */
router.post('/webhook', requireAuth, async (req: Request, res: Response) => {
  const { webhookUrl, channelName } = req.body;
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    return sendError(res, 'Valid Slack webhook URL is required (https://hooks.slack.com/...)', 400);
  }

  await prisma.slackIntegration.upsert({
    where: { userId: req.user!.id },
    update: {
      teamId: 'webhook',
      teamName: 'Slack Workspace',
      channelName: channelName || '#general',
      webhookUrlEncrypted: encrypt(webhookUrl),
      accessTokenEncrypted: encrypt('webhook-token'),
      scope: 'incoming-webhook',
      isActive: true,
      connectedAt: new Date(),
    },
    create: {
      userId: req.user!.id,
      teamId: 'webhook',
      teamName: 'Slack Workspace',
      channelName: channelName || '#general',
      webhookUrlEncrypted: encrypt(webhookUrl),
      accessTokenEncrypted: encrypt('webhook-token'),
      scope: 'incoming-webhook',
    },
  });

  sendSuccess(res, { message: 'Slack webhook connected successfully' });
});

/**
 * DELETE /api/v1/integrations/slack
 * Disconnects Slack integration.
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  await prisma.slackIntegration.updateMany({
    where: { userId: req.user!.id },
    data: { isActive: false },
  });

  sendSuccess(res, { message: 'Slack integration disconnected' });
});

/**
 * GET /api/v1/integrations/slack/notifications
 * Lists rate limit notification events for the current user.
 */
router.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  const events = await prisma.notificationEvent.findMany({
    where: { userId: req.user!.id },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });

  const senderIds = [...new Set(events.map((e) => e.senderId))];
  const senders = await prisma.sender.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, name: true, email: true, maxEmailsPerHour: true },
  });
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const enriched = events.map((event) => {
    const sender = senderMap.get(event.senderId);
    return {
      id: event.id,
      senderId: event.senderId,
      senderEmail: sender?.email || 'Unknown Sender',
      senderName: sender?.name || 'Sender',
      maxEmailsPerHour: sender?.maxEmailsPerHour || 200,
      windowKey: event.windowKey,
      sentAt: event.sentAt,
      isSimulation: env.SHOWCASE_MODE || (!env.SLACK_CLIENT_ID && !env.SLACK_CALLBACK_URL),
      title: `Hourly Rate Limit Reached for ${sender?.email || 'Sender'}`,
      description: `Sender ${sender?.email || 'Sender'} reached its quota of ${sender?.maxEmailsPerHour || 200} emails/hour. Excess emails were automatically deferred to the next hourly window.`,
      notice: 'Demo Alert — Simulated locally. No external Slack message was sent.',
    };
  });

  sendSuccess(res, enriched);
});

export { router as slackRouter };

// Extend session
declare module 'express-session' {
  interface SessionData {
    slackOAuthState?: string;
  }
}
