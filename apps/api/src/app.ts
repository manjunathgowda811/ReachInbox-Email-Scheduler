import 'express-async-errors';
import express from 'express';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { prisma } from './config/prisma';
import { getRedisClient } from './config/redis';
import { ensureIndexExists } from './config/elasticsearch';
import { getEmailQueue } from './queues/emailQueue';
import { passport } from './modules/auth/passport';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requireBullBoardAuth } from './middleware/auth';

// Route imports
import { authRouter } from './modules/auth/auth.router';
import { sendersRouter } from './modules/senders/senders.router';
import { schedulesRouter } from './modules/schedules/schedules.router';
import { emailsRouter } from './modules/emails/emails.router';
import { slackRouter } from './modules/slack/slack.router';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for Bull Board compatibility
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: `${env.MAX_UPLOAD_SIZE_MB + 1}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${env.MAX_UPLOAD_SIZE_MB + 1}mb` }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
      skip: (req) => req.path === '/api/v1/health',
    })
  );
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
  })
);

// ─── Session ──────────────────────────────────────────────────────────────────
let sessionStore: session.Store;
if (env.SHOWCASE_MODE || env.DATABASE_URL.startsWith('file:')) {
  sessionStore = new session.MemoryStore();
} else {
  const PgStore = ConnectPgSimple(session);
  sessionStore = new PgStore({
    conString: env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true,
  });
}

app.use(
  session({
    store: sessionStore,
    secret: env.SESSION_SECRET,
    name: 'reachinbox.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
  })
);

// ─── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─── Bull Board / Queue Dashboard ─────────────────────────────────────────────
if (!env.SHOWCASE_MODE) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(getEmailQueue()) as any],
    serverAdapter,
  });

  app.use(
    '/admin/queues',
    requireBullBoardAuth,
    serverAdapter.getRouter()
  );
} else {
  app.get('/admin/queues', requireBullBoardAuth, (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Queue Dashboard - Showcase Mode</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; line-height: 1.6; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 20px; }
    .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    p { font-size: 14px; color: #94a3b8; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #f43f5e; font-size: 13px; }
    .btn { display: inline-block; background: #38bdf8; color: #0f172a; padding: 10px 18px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Local Showcase Mode</span>
    <h2>Persistent Local Database Scheduler Active</h2>
    <p>The scheduler is currently running with the zero-configuration local database queue (SQLite on disk), allowing full scheduling, pacing, and execution without external Redis or BullMQ dependencies.</p>
    <p>To access the real Bull Board queue monitor with distributed Redis, start the full assignment mode using: <code>docker compose up -d &amp;&amp; npm run dev</code>.</p>
    <a href="http://localhost:3000/dashboard" class="btn">Return to Dashboard</a>
  </div>
</body>
</html>`);
  });
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/senders', sendersRouter);
app.use('/api/v1/schedules', schedulesRouter);
app.use('/api/v1/emails', emailsRouter);
app.use('/api/v1/search/emails', emailsRouter); // search reuses emailsRouter /search endpoint
app.use('/api/v1/integrations/slack', slackRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (_req, res) => {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  if (env.SHOWCASE_MODE) {
    checks.mode = 'showcase';
    checks.scheduler = 'local_sqlite_persistent_queue';
    const ok = checks.database === 'ok';
    return res.status(ok ? 200 : 503).json({ success: ok, checks });
  }

  checks.redis = 'unknown';
  checks.elasticsearch = 'unknown';

  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  try {
    const { getElasticsearchClient } = await import('./config/elasticsearch');
    const es = getElasticsearchClient();
    await es.ping();
    checks.elasticsearch = 'ok';
  } catch {
    checks.elasticsearch = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ success: allOk, checks });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Server Startup ───────────────────────────────────────────────────────────
async function bootstrap() {
  if (env.SHOWCASE_MODE) {
    const { startShowcaseScheduler } = await import('./queues/showcaseScheduler');
    startShowcaseScheduler();
    logger.info('Local database-backed scheduler started for Showcase Mode');
  } else {
    // Ensure ES index exists (non-blocking)
    ensureIndexExists().catch((err) =>
      logger.warn('ES index setup deferred', { err: (err as Error).message })
    );
  }

  const server = app.listen(env.API_PORT, () => {
    logger.info(`API server running on port ${env.API_PORT}`, {
      env: env.NODE_ENV,
      showcaseMode: env.SHOWCASE_MODE,
      bullBoard: `http://localhost:${env.API_PORT}/admin/queues`,
    });
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully…`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        if (!env.SHOWCASE_MODE) {
          const { closeRedis } = await import('./config/redis');
          await closeRedis();
        } else {
          const { stopShowcaseScheduler } = await import('./queues/showcaseScheduler');
          stopShowcaseScheduler();
        }
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Shutdown error', { err: (err as Error).message });
        process.exit(1);
      }
    });

    // Force exit after 15s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start API', { err: err.message });
  process.exit(1);
});

export { app };
