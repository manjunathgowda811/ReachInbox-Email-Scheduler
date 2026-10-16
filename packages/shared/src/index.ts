// Shared types for the ReachInbox Email Scheduler
// Used by both API and Worker

export type ScheduleStatus = 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type EmailJobStatus = 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'RATE_LIMITED';

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

// ─── Sender ──────────────────────────────────────────────────────────────────

export interface SenderDto {
  id: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  maxEmailsPerHour: number;
  minDelayMs: number;
  isEthereal: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSenderDto {
  name: string;
  email: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  maxEmailsPerHour?: number;
  minDelayMs?: number;
  isEthereal?: boolean;
}

// ─── Email Schedule ──────────────────────────────────────────────────────────

export interface EmailScheduleDto {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  status: ScheduleStatus;
  startAt: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleDto {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
}

// ─── Email Job ───────────────────────────────────────────────────────────────

export interface EmailJobDto {
  id: string;
  scheduleId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  status: EmailJobStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  attemptCount: number;
  lastError: string | null;
  etherealPreviewUrl: string | null;
  createdAt: string;
}

// ─── BullMQ Job Payloads ─────────────────────────────────────────────────────

export interface EmailJobPayload {
  emailJobId: string;
  scheduleId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attemptNumber: number;
}

// ─── Slack ───────────────────────────────────────────────────────────────────

export interface SlackStatusDto {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  connectedAt?: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchEmailsDto {
  query?: string;
  status?: EmailJobStatus;
  senderId?: string;
  recipientEmail?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SearchResultDto {
  items: EmailJobDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Queue Names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL_SEND: 'email_send',
  EMAIL_OUTBOX: 'email_outbox',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Redis Keys ──────────────────────────────────────────────────────────────

export const REDIS_KEYS = {
  rateLimitCounter: (senderId: string, windowKey: string) =>
    `rate:${senderId}:${windowKey}`,
  lastSendTime: (senderId: string) => `last_send:${senderId}`,
  rateLimitNotified: (senderId: string, windowKey: string) =>
    `notified:${senderId}:${windowKey}`,
} as const;

// ─── Hourly Window Utility ───────────────────────────────────────────────────

export function getCurrentHourWindowKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}:${hh}`;
}

export function getNextHourStart(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(now.getUTCHours() + 1);
  return next;
}
