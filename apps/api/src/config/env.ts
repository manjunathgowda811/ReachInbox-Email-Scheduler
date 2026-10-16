import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

  SHOWCASE_MODE: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
  }, z.boolean()).default(false),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default(
    process.env.SHOWCASE_MODE === 'true'
      ? 'file:./showcase.db'
      : (process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox?schema=public')
  ),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SESSION_SECRET: z.string().min(16).default('reachinbox_super_secret_session_key_production_32ch'),
  ENCRYPTION_KEY: z.string().min(1).default('reachinbox_secret_aes_key_32chars'),

  GOOGLE_CLIENT_ID: z.string().default('dummy-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('dummy-google-client-secret'),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/api/v1/auth/google/callback'),

  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),

  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_CALLBACK_URL: z.string().optional(),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(5),
  MAX_RECIPIENTS_PER_SCHEDULE: z.coerce.number().default(10000),

  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('admin'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
