import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  // Never log OAuth tokens, SMTP passwords, session secrets
  defaultMeta: { service: 'reachinbox-api' },
});

// Sanitize sensitive fields from log output
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set([
    'password', 'smtpPass', 'accessToken', 'refreshToken',
    'secret', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'GOOGLE_CLIENT_SECRET',
    'SLACK_CLIENT_SECRET', 'token', 'webhookUrl',
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sensitive.has(key) ? '[REDACTED]' : value;
  }
  return result;
}
