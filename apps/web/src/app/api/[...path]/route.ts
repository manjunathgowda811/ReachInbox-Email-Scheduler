import { NextRequest, NextResponse } from 'next/server';

interface MockSender {
  id: string;
  userId: string;
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

interface MockEmailJob {
  id: string;
  scheduleId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  scheduledAt: string;
  processedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  attemptCount: number;
  lastError?: string | null;
  messageId?: string;
  etherealPreviewUrl?: string;
  sequenceIndex: number;
  createdAt: string;
  sender?: { name: string; email: string };
  schedule?: { subject: string };
}

interface MockSchedule {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  startAt: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sender?: { name: string; email: string };
}

const DEMO_USER = {
  id: 'cmvaqf9m90000abm6mbgh2vmr',
  email: 'oliver.brown@domain.io',
  name: 'Oliver Brown',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
};

const DEFAULT_SENDER: MockSender = {
  id: 'cmvaqf9mt0002abm6dvveqc7t',
  userId: DEMO_USER.id,
  name: 'Oliver Brown (Demo Sender)',
  email: 'oliver.brown@domain.io',
  smtpHost: 'smtp.ethereal.email',
  smtpPort: 587,
  maxEmailsPerHour: 200,
  minDelayMs: 2000,
  isEthereal: true,
  isActive: true,
  createdAt: '2026-10-16T08:55:06.629Z',
};

// Global in-memory mock store for Vercel serverless showcase
let schedules: MockSchedule[] = [
  {
    id: 'sched-showcase-welcome',
    userId: DEMO_USER.id,
    senderId: DEFAULT_SENDER.id,
    subject: 'ReachInbox Product Showcase Campaign',
    body: '<h2>Welcome Hiring Team!</h2><p>This is a live demonstration of ReachInbox Email Scheduler running on Vercel.</p>',
    status: 'COMPLETED',
    startAt: '2026-10-16T08:57:55.990Z',
    totalRecipients: 2,
    sentCount: 2,
    failedCount: 0,
    createdAt: '2026-10-16T08:57:55.999Z',
    sender: { name: DEFAULT_SENDER.name, email: DEFAULT_SENDER.email },
  },
];

let emailJobs: MockEmailJob[] = [
  {
    id: 'job-showcase-1',
    scheduleId: 'sched-showcase-welcome',
    senderId: DEFAULT_SENDER.id,
    userId: DEMO_USER.id,
    recipientEmail: 'hiring.reviewer@reachinbox.ai',
    subject: 'ReachInbox Product Showcase Campaign',
    body: '<h2>Welcome Hiring Team!</h2><p>This is a live demonstration of ReachInbox Email Scheduler running on Vercel.</p>',
    status: 'SENT',
    scheduledAt: '2026-10-16T08:57:55.990Z',
    processedAt: '2026-10-16T08:57:56.695Z',
    sentAt: '2026-10-16T08:57:56.708Z',
    attemptCount: 1,
    messageId: '<showcase-1@reachinbox.local>',
    etherealPreviewUrl: '/api/v1/emails/job-showcase-1/preview',
    sequenceIndex: 0,
    createdAt: '2026-10-16T08:57:55.999Z',
    sender: { name: DEFAULT_SENDER.name, email: DEFAULT_SENDER.email },
    schedule: { subject: 'ReachInbox Product Showcase Campaign' },
  },
  {
    id: 'job-showcase-2',
    scheduleId: 'sched-showcase-welcome',
    senderId: DEFAULT_SENDER.id,
    userId: DEMO_USER.id,
    recipientEmail: 'engineering.team@reachinbox.ai',
    subject: 'ReachInbox Product Showcase Campaign',
    body: '<h2>Welcome Hiring Team!</h2><p>This is a live demonstration of ReachInbox Email Scheduler running on Vercel.</p>',
    status: 'SENT',
    scheduledAt: '2026-10-16T08:57:57.990Z',
    processedAt: '2026-10-16T08:58:00.702Z',
    sentAt: '2026-10-16T08:58:00.719Z',
    attemptCount: 1,
    messageId: '<showcase-2@reachinbox.local>',
    etherealPreviewUrl: '/api/v1/emails/job-showcase-2/preview',
    sequenceIndex: 1,
    createdAt: '2026-10-16T08:57:55.999Z',
    sender: { name: DEFAULT_SENDER.name, email: DEFAULT_SENDER.email },
    schedule: { subject: 'ReachInbox Product Showcase Campaign' },
  },
];

let notificationEvents = [
  {
    id: 'notif-showcase-1',
    senderId: DEFAULT_SENDER.id,
    senderEmail: DEFAULT_SENDER.email,
    senderName: DEFAULT_SENDER.name,
    maxEmailsPerHour: 200,
    windowKey: `${DEFAULT_SENDER.id}:2026-10-16-09`,
    sentAt: new Date().toISOString(),
    isSimulation: true,
    title: `Hourly Rate Limit Reached for ${DEFAULT_SENDER.email}`,
    description: `Sender ${DEFAULT_SENDER.email} reached its quota of 200 emails/hour. Excess emails were automatically deferred to the next hourly window.`,
    notice: 'Demo Alert — Simulated locally. No external Slack message was sent.',
  },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handlePreview(job: MockEmailJob) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Email Preview: ${escapeHtml(job.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .banner { background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e40af; padding: 14px 20px; font-size: 13px; line-height: 1.5; }
    .banner strong { font-weight: 600; color: #1e3a8a; }
    .meta { padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .meta-row { display: flex; margin-bottom: 8px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { width: 110px; color: #64748b; font-weight: 500; }
    .meta-value { color: #0f172a; font-weight: 500; flex: 1; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-sent { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef9c3; color: #854d0e; }
    .body { padding: 28px 20px; font-size: 14px; line-height: 1.6; color: #334155; }
    .footer { padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="banner">
      <strong>Demo Delivery</strong> — Simulated locally. No external email was sent.
      <div style="font-size: 11px; color: #3b82f6; margin-top: 3px;">Simulated via ReachInbox Showcase Engine • Rate limits & pacing enforced</div>
    </div>
    <div class="meta">
      <div class="meta-row"><div class="meta-label">Subject:</div><div class="meta-value">${escapeHtml(job.subject)}</div></div>
      <div class="meta-row"><div class="meta-label">From:</div><div class="meta-value">${escapeHtml(job.sender?.name || 'Sender')} &lt;${escapeHtml(job.sender?.email || '')}&gt;</div></div>
      <div class="meta-row"><div class="meta-label">To:</div><div class="meta-value">${escapeHtml(job.recipientEmail)}</div></div>
      <div class="meta-row"><div class="meta-label">Status:</div><div class="meta-value"><span class="badge badge-sent">${job.status}</span></div></div>
      <div class="meta-row"><div class="meta-label">Sent At:</div><div class="meta-value">${job.sentAt ? new Date(job.sentAt).toLocaleString() : 'Not sent yet'}</div></div>
      <div class="meta-row"><div class="meta-label">Message ID:</div><div class="meta-value" style="font-family: monospace; font-size: 11px;">${escapeHtml(job.messageId || 'N/A')}</div></div>
    </div>
    <div class="body">
      ${job.body}
    </div>
    <div class="footer">
      ReachInbox Email Scheduler • Hosted Showcase Demo
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');

  // 1. Health check
  if (path === 'v1/health' || path === 'health') {
    return NextResponse.json({
      success: true,
      checks: { api: 'ok', mode: 'showcase_hosted' },
    });
  }

  // 2. Auth /me
  if (path === 'v1/auth/me') {
    const sessionCookie = req.cookies.get('reachinbox.sid')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: DEMO_USER });
  }

  // 3. Senders list
  if (path === 'v1/senders') {
    return NextResponse.json({ success: true, data: [DEFAULT_SENDER] });
  }

  // 4. Schedules list
  if (path === 'v1/schedules') {
    return NextResponse.json({
      success: true,
      data: schedules,
      meta: { total: schedules.length, page: 1, limit: 20, totalPages: 1 },
    });
  }

  // 5. Emails - scheduled
  if (path === 'v1/emails/scheduled') {
    const list = emailJobs.filter((j) => ['PENDING', 'SCHEDULED', 'RATE_LIMITED'].includes(j.status));
    return NextResponse.json({
      success: true,
      data: list,
      meta: { total: list.length, page: 1, limit: 20, totalPages: 1 },
    });
  }

  // 6. Emails - sent
  if (path === 'v1/emails/sent') {
    const list = emailJobs.filter((j) => ['SENT', 'FAILED'].includes(j.status));
    return NextResponse.json({
      success: true,
      data: list,
      meta: { total: list.length, page: 1, limit: 20, totalPages: 1 },
    });
  }

  // 7. Emails - search
  if (path === 'v1/emails/search') {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const filtered = emailJobs.filter(
      (j) =>
        !q ||
        j.subject.toLowerCase().includes(q) ||
        j.recipientEmail.toLowerCase().includes(q)
    );
    return NextResponse.json({
      success: true,
      data: filtered,
      meta: { total: filtered.length, page: 1, limit: 20, totalPages: 1 },
    });
  }

  // 8. Email preview (/api/v1/emails/:id/preview)
  if (path.startsWith('v1/emails/') && path.endsWith('/preview')) {
    const parts = path.split('/');
    const id = parts[2];
    const job = emailJobs.find((j) => j.id === id) || emailJobs[0];
    return handlePreview(job);
  }

  // 9. Single Email job (/api/v1/emails/:id)
  if (path.startsWith('v1/emails/')) {
    const id = path.split('/')[2];
    const job = emailJobs.find((j) => j.id === id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Email job not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: job });
  }

  // 10. Slack integrations
  if (path === 'v1/integrations/slack/status') {
    return NextResponse.json({ success: true, data: { connected: false } });
  }

  if (path === 'v1/integrations/slack/notifications') {
    return NextResponse.json({ success: true, data: notificationEvents });
  }

  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');

  // 1. Dev Login
  if (path === 'v1/auth/dev-login') {
    const res = NextResponse.json({
      success: true,
      data: DEMO_USER,
    });
    // Set authenticated session cookie
    res.cookies.set({
      name: 'reachinbox.sid',
      value: `demo-session-${Date.now()}`,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  }

  // 2. Logout
  if (path === 'v1/auth/logout') {
    const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
    res.cookies.set({
      name: 'reachinbox.sid',
      value: '',
      path: '/',
      maxAge: 0,
    });
    return res;
  }

  // 3. Create Schedule
  if (path === 'v1/schedules') {
    let body: any = {};
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        body.senderId = formData.get('senderId') as string;
        body.subject = formData.get('subject') as string;
        body.body = formData.get('body') as string;
        body.startAt = formData.get('startAt') as string;
        body.recipients = ['hiring.reviewer@reachinbox.ai'];
      }
    } catch {
      // Fallback
    }

    const recipients: string[] = body.recipients && body.recipients.length > 0
      ? body.recipients
      : ['applicant.reviewer@reachinbox.ai'];

    const newScheduleId = `sched-${Date.now()}`;
    const newSchedule: MockSchedule = {
      id: newScheduleId,
      userId: DEMO_USER.id,
      senderId: body.senderId || DEFAULT_SENDER.id,
      subject: body.subject || 'New Campaign',
      body: body.body || '<p>Email body</p>',
      status: 'COMPLETED',
      startAt: body.startAt || new Date().toISOString(),
      totalRecipients: recipients.length,
      sentCount: recipients.length,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      sender: { name: DEFAULT_SENDER.name, email: DEFAULT_SENDER.email },
    };

    schedules.unshift(newSchedule);

    // Create jobs for each recipient (marked as SENT)
    recipients.forEach((email, idx) => {
      const jobId = `job-${Date.now()}-${idx}`;
      emailJobs.unshift({
        id: jobId,
        scheduleId: newScheduleId,
        senderId: DEFAULT_SENDER.id,
        userId: DEMO_USER.id,
        recipientEmail: email,
        subject: newSchedule.subject,
        body: newSchedule.body,
        status: 'SENT',
        scheduledAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        attemptCount: 1,
        messageId: `<showcase-${jobId}@reachinbox.local>`,
        etherealPreviewUrl: `/api/v1/emails/${jobId}/preview`,
        sequenceIndex: idx,
        createdAt: new Date().toISOString(),
        sender: { name: DEFAULT_SENDER.name, email: DEFAULT_SENDER.email },
        schedule: { subject: newSchedule.subject },
      });
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          scheduleId: newScheduleId,
          totalRecipients: recipients.length,
          enqueuedJobs: recipients.length,
          startAt: newSchedule.startAt,
        },
      },
      { status: 201 }
    );
  }

  // 4. Cancel schedule
  if (path.startsWith('v1/schedules/') && path.endsWith('/cancel')) {
    const id = path.split('/')[2];
    const s = schedules.find((item) => item.id === id);
    if (s) s.status = 'CANCELLED';
    return NextResponse.json({ success: true, message: 'Schedule cancelled' });
  }

  // 5. Connect Slack Webhook simulation
  if (path === 'v1/integrations/slack/webhook') {
    return NextResponse.json({ success: true, message: 'Webhook connected successfully' });
  }

  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  if (path === 'v1/integrations/slack') {
    return NextResponse.json({ success: true, message: 'Slack integration disconnected' });
  }
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
