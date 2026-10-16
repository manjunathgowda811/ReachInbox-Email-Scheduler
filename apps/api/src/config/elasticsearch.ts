import { Client } from '@elastic/elasticsearch';
import { env } from './env';
import { logger } from '../utils/logger';

let esClient: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: env.ELASTICSEARCH_URL,
      requestTimeout: 10000,
    });
  }
  return esClient;
}

export const EMAIL_INDEX = 'reachinbox_emails';

export async function ensureIndexExists(): Promise<void> {
  const client = getElasticsearchClient();
  try {
    const exists = await client.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await client.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            scheduleId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            senderName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            recipientEmail: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: { type: 'text', analyzer: 'english' },
            body: { type: 'text', analyzer: 'english' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            failedAt: { type: 'date' },
            attemptCount: { type: 'integer' },
            etherealPreviewUrl: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          refresh_interval: '1s',
        },
      });
      logger.info(`Elasticsearch index '${EMAIL_INDEX}' created`);
    }
  } catch (err) {
    // ES not available — degrade gracefully, don't crash
    logger.warn('Elasticsearch index setup failed (will retry later)', {
      err: (err as Error).message,
    });
  }
}
