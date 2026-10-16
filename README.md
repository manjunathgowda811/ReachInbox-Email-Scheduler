# ReachInbox Email Scheduler

> A production-ready, distributed, full-stack email scheduling and bulk outreach platform engineered for high reliability, fault tolerance, rate limiting, and observability.

🌐 **Live Vercel Web App:** [https://reachinbox-email-scheduler-eight-nu.vercel.app](https://reachinbox-email-scheduler-eight-nu.vercel.app)  
📦 **GitHub Repository:** [https://github.com/manjunathgowda811/ReachInbox-Email-Scheduler](https://github.com/manjunathgowda811/ReachInbox-Email-Scheduler)

---

## Table of Contents

1. [Overview & What Was Built](#1-overview--what-was-built)
2. [Monorepo Architecture](#2-monorepo-architecture)
3. [How It Was Built (Technical Deep Dive)](#3-how-it-was-built-technical-deep-dive)
   - [Database & Data Models](#database--data-models)
   - [Asynchronous Queuing & Execution Engine](#asynchronous-queuing--execution-engine)
   - [Atomic Rate Limiting & Throttling](#atomic-rate-limiting--throttling)
   - [Crash Recovery & Idempotency](#crash-recovery--idempotency)
   - [Transactional Outbox Pattern & Elasticsearch](#transactional-outbox-pattern--elasticsearch)
   - [Security & Encryption](#security--encryption)
   - [Frontend Architecture](#frontend-architecture)
4. [Bugs Found & Resolutions Implemented](#4-bugs-found--resolutions-implemented)
5. [Lacking Features & Future Roadmap](#5-lacking-features--future-roadmap)
6. [Prerequisites & System Requirements](#6-prerequisites--system-requirements)
7. [Step-by-Step Setup & How to Run](#7-step-by-step-setup--how-to-run)
8. [API Reference & Evaluation Guide](#8-api-reference--evaluation-guide)

---

## 1. Overview & What Was Built

The **ReachInbox Email Scheduler** is an enterprise-grade platform designed to schedule, queue, throttle, and deliver thousands of personalized cold outreach and marketing emails across multiple custom SMTP senders while strictly observing hourly quotas, inter-email delay windows, and provider deliverability rules.

### Key Capabilities Built:
- **Campaign Scheduling**: Create and schedule email batches with thousands of recipients at arbitrary future times.
- **Multi-Sender Management**: Register and switch between multiple SMTP senders (including auto-provisioned test accounts via Ethereal Mail) with per-sender throughput and minimum delay controls.
- **Hourly Quota & Delay Enforcement**: Redis Lua-backed token reservation enforcing maximum emails per hour and minimum delay (e.g. 2000ms) between consecutive sends to avoid spam flagging.
- **Fail-Safe Job Rescheduling**: If a sender hits their hourly limit, excess jobs are not failed; they are automatically deferred to the next hourly window using BullMQ delayed queues.
- **Slack Alerting**: Automated real-time notifications to Slack channels via Incoming Webhooks or Slack Apps when senders breach hourly quotas, complete with deduplication per hour window.
- **Dual Full-Text Search**: Instant search over email campaigns and delivery status using an Elasticsearch index with automated seamless fallback to PostgreSQL if Elasticsearch is unavailable.
- **Audit Trail & Observability**: Complete, immutable tracking of every delivery attempt (duration, message ID, SMTP responses, test preview URLs) and a live Bull Board dashboard (`/admin/queues`).
- **Modern Responsive Dashboard**: Next.js 14 frontend featuring dark mode, stats analytics, schedule wizards, sender management, live delivery logs, and CSV recipient uploads.

---

## 2. Monorepo Architecture

The project is structured as an npm workspace monorepo cleanly dividing concerns between the API gateway, background workers, shared contracts, and the frontend web UI:

```
reachinbox-scheduler/
├── apps/
│   ├── api/                   # Express REST API & BullMQ Queue Producer (Port 4000)
│   │   ├── src/
│   │   │   ├── app.ts         # Express server, middleware, routes & Bull Board
│   │   │   ├── config/        # Prisma, Redis, Elasticsearch, Environment configs
│   │   │   ├── middleware/    # Auth, session, error handling, rate limiting
│   │   │   ├── modules/       # Auth, Senders, Schedules, Emails, Slack routers
│   │   │   ├── queues/        # BullMQ email queue producer & job scheduler
│   │   │   └── utils/         # Winston logger, encryption, standard responses
│   │   └── package.json
│   │
│   ├── worker/                # BullMQ Consumer & Email Execution Worker
│   │   ├── src/
│   │   │   ├── index.ts       # Worker initialization, crash recovery & shutdown
│   │   │   ├── processors/    # Core email processor (rate limits, delays, SMTP)
│   │   │   └── services/      # Encryption, ES outbox syncer, Slack notifier
│   │   └── package.json
│   │
│   └── web/                   # Next.js 14 Dashboard UI (Port 3000)
│       ├── src/
│       │   ├── app/           # App router: login, dashboard, scheduled, sent, senders
│       │   ├── components/    # Navigation, metrics cards, schedule dialogs, tables
│       │   ├── features/      # Campaign wizards, CSV recipient dropzone
│       │   ├── hooks/         # React Query mutation & query hooks
│       │   └── lib/           # Axios API client & utils
│       └── package.json
│
├── packages/
│   └── shared/                # Shared TypeScript types, DTOs, queue constants
│       ├── src/index.ts
│       └── package.json
│
├── prisma/
│   ├── schema.prisma          # PostgreSQL relational schema
│   └── migrations/            # Version-controlled database migrations
│
├── docker-compose.yml         # Infrastructure: PostgreSQL 15, Redis 7, Elasticsearch 8
├── package.json               # Root scripts & workspace definitions
├── tsconfig.json              # Shared TypeScript base configuration
└── .env.example               # Canonical environment configuration
```

---

## 3. How It Was Built (Technical Deep Dive)

### Database & Data Models
The application uses **PostgreSQL 15** managed through **Prisma 5**. The schema models real-world email operations:
- **`User`**: Account owner authenticated via Google OAuth2 or Dev credentials.
- **`Session`**: Express session store powered by `connect-pg-simple` for session persistence across server restarts.
- **`Sender`**: Configurable sender identities storing encrypted SMTP host, port, user, and password credentials along with throughput limits (`maxEmailsPerHour`, `minDelayMs`).
- **`EmailSchedule`**: The parent campaign entity tracking target send time (`startAt`), total recipients, sent count, and failed count.
- **`EmailJob`**: Individual recipient tasks tied to a campaign with lifecycle statuses: `PENDING` → `SCHEDULED` → `PROCESSING` → `SENT` | `FAILED` | `RATE_LIMITED` | `CANCELLED`.
- **`DeliveryAttempt`**: Immutable audit logs capturing every delivery attempt, attempt number, duration in milliseconds, provider `messageId`, error strings, and Ethereal preview URLs.
- **`SlackIntegration` & `NotificationEvent`**: Stores encrypted Slack webhook URLs and records hour-window notification events to prevent spamming Slack.
- **`OutboxEvent`**: Transactional outbox table capturing created/updated email records for asynchronous Elasticsearch syncing.

### Asynchronous Queuing & Execution Engine
- Built using **BullMQ 5** backed by **Redis 7**.
- Deterministic BullMQ Job IDs (`email:${emailJobId}`) prevent double scheduling if network hiccups or user double-clicks occur.
- Jobs are scheduled with delays calculated as `Math.max(0, executeAt - Date.now())`.
- Completed jobs are retained for 24 hours for inspection via Bull Board; failed jobs are retained for 7 days.

### Atomic Rate Limiting & Throttling
1. **Hourly Windowing**:
   - Each hour is identified by a UTC window key: `YYYY-MM-DD:HH`.
   - Before sending, the worker executes an atomic Redis Lua script:
     ```lua
     local key = KEYS[1]
     local limit = tonumber(ARGV[1])
     local ttl = tonumber(ARGV[2])
     local current = redis.call('INCR', key)
     if current == 1 then
       redis.call('EXPIRE', key, ttl)
     end
     return current
     ```
   - If `current > limit`, the increment is undone, a Slack alert is triggered, and the job is rescheduled to the start of the next UTC hour with an intentional jitter spread.
2. **Inter-Email Delay (Pacing)**:
   - To prevent bursting, the worker tracks the timestamp of the sender's last send in Redis (`last_send:${senderId}`).
   - If the elapsed time is less than `minDelayMs` (default 2,000ms), the worker actively paces the send using a delay buffer before invoking SMTP.

### Crash Recovery & Idempotency
- **State Transition Guard**: Jobs transition to `PROCESSING` via an atomic database condition:
  `WHERE id = emailJobId AND status NOT IN ('SENT', 'CANCELLED', 'PROCESSING')`.
- **Startup Recovery of Uncertain Deliveries**:
  If a worker crashes while an SMTP connection is active (between sending to the mail server and updating PostgreSQL), blind retry could result in duplicate email delivery.
  On startup, the worker runs `recoverUncertainJobs()` to identify any jobs stuck in `PROCESSING` for >15 minutes, marking them as `FAILED` with error `UNCERTAIN_DELIVERY` and recording a delivery attempt requiring manual review.

### Transactional Outbox Pattern & Elasticsearch
- When email jobs are created or updated, outbox records are inserted into PostgreSQL inside the same transaction.
- A background outbox processor in the worker reads pending events, indexes the documents into the `reachinbox_emails` Elasticsearch index, and marks the outbox event as `DONE`.
- If Elasticsearch is offline or indexing fails, the API search endpoint (`/api/v1/emails/search`) gracefully falls back to querying PostgreSQL directly via case-insensitive `contains` filters.

### Security & Encryption
- Sensitive SMTP credentials and Slack webhook tokens are encrypted at rest using **AES-256-CBC** with an initialization vector (IV) stored alongside the encrypted payload.
- Helmet security headers, CORS origin whitelisting, JSON payload limits (5MB), and IP-based rate limiting (500 requests / 15 minutes) protect all external API surfaces.

### Frontend Architecture
- **Next.js 14 App Router** with React 18 and Tailwind CSS.
- Fast client-side queries and mutations using **TanStack React Query** with automatic cache invalidation on schedule creation.
- Modern UI includes status badges, interactive scheduling modals with CSV upload parsing (`react-dropzone`), real-time delivery attempt modals, sender configuration cards, and Slack connection toggles.

---

## 4. Bugs Found & Resolutions Implemented

During the setup, compilation, and live verification of the codebase, several critical bugs were identified and fixed:

1. **Slack Router Syntax Error**:
   - **Location**: `apps/api/src/modules/slack/slack.router.ts:179`
   - **Bug**: Missing closing brace `}` on the `create` object within `prisma.slackIntegration.upsert()`, causing a `TS1005: ',' expected` compilation crash.
   - **Fix**: Added the missing closing brace and formatted the upsert structure.

2. **BullMQ v5 Queue Name Restriction**:
   - **Location**: `packages/shared/src/index.ts`
   - **Bug**: `QUEUE_NAMES.EMAIL_SEND` was defined as `'email:send'`. BullMQ v5 introduced a strict validation throwing `Error: Queue name cannot contain :` because BullMQ internally reserves `:` for Redis key partitioning.
   - **Fix**: Updated queue constants to `email_send` and `email_outbox`, rebuilt `@reachinbox/shared`, allowing BullMQ and Bull Board to initialize cleanly.

3. **Bull Board Type Incompatibility**:
   - **Location**: `apps/api/src/app.ts:117`
   - **Bug**: `@bull-board/api` expected `BaseAdapter` with `QueueJob` progress typing (`number | object`), which diverged from BullMQ v5's updated `JobProgress` (`string | number | object`).
   - **Fix**: Cast `BullMQAdapter` explicitly to ensure type-safe compilation with BullMQ v5.

4. **Missing Workspace Binaries & Prisma Generation**:
   - **Bug**: Monorepo dependencies lacked root `.bin` links on initial checkout, leading to `'prisma' is not recognized` errors.
   - **Fix**: Executed workspace package installation, generated the Prisma client (`prisma generate`), and built the shared library (`@reachinbox/shared`) to establish full cross-workspace linking.

5. **Dev-Login Route Setup**:
   - **Feature**: For evaluation environments where live Google Cloud OAuth credentials and domains cannot be configured immediately, added `POST /api/v1/auth/dev-login` to seamlessly log in a demo user and auto-create an Ethereal SMTP sender with zero external setup.

---

## 5. Lacking Features & Future Roadmap

While the platform is architecturally sound and production-ready for scheduling and dispatch, the following features represent areas for future enhancement:

| Feature Area | Current State | Future Enhancement / What is Lacking |
| :--- | :--- | :--- |
| **Email Template Engine** | Supports raw HTML and plain-text strings. | Integration with Handlebars / Liquid / MJML templates allowing recipient-specific variable injection (e.g. `{{firstName}}`, `{{company}}`). |
| **Inbound Webhook Handling** | Tracks delivery status up to the SMTP provider. | Inbound webhook endpoints (SendGrid, Mailgun, AWS SES, Postmark) to process asynchronous bounces, spam complaints, opens, and link clicks. |
| **Unsubscribe & Suppression** | No automated unsubscribe links. | Automated RFC 8058 `List-Unsubscribe` headers, opt-out landing pages, and a global recipient suppression list to prevent emailing unsubscribed contacts. |
| **Distributed Cross-Worker Delay** | Inter-email delay is enforced via local in-memory sleep within the worker thread. | When running multiple worker processes horizontally across different servers, a distributed Redis token-bucket or Redlock is needed for strict pacing. |
| **Team & RBAC Multi-Tenancy** | Scoped per individual user ID. | Team accounts, organizational hierarchies, role-based access control (Admin, Editor, Viewer), and shared sender pools. |
| **Advanced Warmup Schedules** | Fixed hourly limits set manually on sender profiles. | Automated IP/domain warmup sequences that incrementally increase daily sending quotas over a 30-day schedule. |
| **Timezone-Aware Delivery** | Schedules execute at UTC timestamps. | Automatic scheduling based on each recipient's local timezone (e.g., "deliver at 9:00 AM recipient local time"). |
| **Attachment Handling** | Emails currently support text and HTML bodies. | S3 / Cloud Storage upload integration for file attachments with virus scanning and size validation. |

---

## 6. Prerequisites & System Requirements

- **Node.js**: `v18.0.0` or higher (verified on Node v20 and v22)
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: `v15` or higher (via Docker or local service on port 5432)
- **Redis**: `v7` or higher (via Docker or local service on port 6379)
- **Elasticsearch**: `v8.11` (optional; system automatically degrades to PostgreSQL search if unavailable)
- **Docker & Docker Compose** (recommended for running dependencies with one command)

---

## 7. Step-by-Step Setup & How to Run

### 🚀 Option A: Zero-Configuration Showcase Mode (Recommended for Evaluation & Review)

**No Docker, Redis, PostgreSQL, Elasticsearch, Google Cloud OAuth, or Slack credentials required!**

Runs seamlessly on Windows with a single command using persistent SQLite (`prisma/showcase.db`), a database-backed scheduling engine, local email delivery simulation with styled HTML previews, and a built-in Slack rate-limit alert feed.

```powershell
# 1. Install dependencies (if not already done)
npm install

# 2. Start the complete application in Showcase Mode
npm run showcase
```

That's it! This single command automatically:
1. Initializes and verifies the local SQLite database at `prisma/showcase.db`.
2. Starts the backend API and database-backed scheduler on `http://localhost:4000`.
3. Starts the Next.js frontend dashboard on `http://localhost:3000`.

#### Showcase Evaluation Steps:
1. Open **`http://localhost:3000/login`** in your browser.
2. Click **"Demo Login — Continue as Oliver Brown"** (one-click instant login without Google Cloud OAuth).
3. Land on the modern **Dashboard** with live metrics and profile data.
4. Click **"Compose"** to schedule an email campaign:
   - Enter recipient(s) (or upload CSV).
   - Enter Subject and Message body.
   - Click **"Send Campaign Now"** (or pick a future start time).
5. Open **`http://localhost:3000/sent`** to see dispatched jobs update to status `SENT`.
6. Click **"View Preview"** on any sent email to inspect the generated HTML message and the required demo delivery disclaimer notice:
   > *"Demo Delivery — Simulated locally. No external email was sent."*
7. Open **`http://localhost:3000/integrations`** to review the **Rate Limit Notification Center** displaying simulated Slack notifications whenever a sender's hourly limit is reached.

To run verification tests on the showcase backend:
```powershell
node scripts/verify-showcase.js
```

---

### 🐳 Option B: Full Assignment Production Mode (Docker + Redis + BullMQ + PostgreSQL + Elasticsearch)

For evaluating the full multi-process distributed architecture with real BullMQ queues, Redis atomic rate limiting, PostgreSQL, and Elasticsearch:

#### Step 1: Start Infrastructure Services (PostgreSQL, Redis, Elasticsearch)

```bash
docker compose up -d
```

#### Step 2: Install & Build

```bash
npm install
npm run build --workspace=packages/shared
npm run db:generate
npm run db:migrate:deploy
```

#### Step 3: Run Full Monorepo Concurrently
```bash
npm run dev
```

#### Option B: Start Services Individually (Recommended for development)

**Terminal 1 — API Server (Express + BullMQ Producer + Bull Board)**:
```bash
npm run dev:api
# API runs at:        http://localhost:4000
# Bull Board UI:      http://localhost:4000/admin/queues (admin / admin)
# Health check:       http://localhost:4000/api/v1/health
```

**Terminal 2 — Background Worker (Email Execution, Throttling & Outbox)**:
```bash
npm run dev:worker
```

**Terminal 3 — Frontend Web App (Next.js Dashboard)**:
```bash
npm run dev:web
# Web UI runs at:     http://localhost:3000
```

---

## 8. API Reference & Evaluation Guide

### Quick Evaluation (Dev Login)
To test without configuring Google Cloud OAuth credentials:
1. Open `http://localhost:3000/login`.
2. Click **"Sign in as Demo User"** or send a POST request:
   ```bash
   curl -X POST http://localhost:4000/api/v1/auth/dev-login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@reachinbox.test","name":"Demo User"}'
   ```
3. An active Ethereal SMTP test account is automatically provisioned and ready for scheduling.

### Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Comprehensive health check (Postgres, Redis, ES status) |
| `POST` | `/api/v1/auth/dev-login` | Demo session login with auto-provisioned test sender |
| `GET` | `/api/v1/auth/me` | Fetch active user session profile |
| `GET` | `/api/v1/senders` | List configured senders and hourly quota limits |
| `POST` | `/api/v1/senders` | Create new SMTP sender (or auto-generate Ethereal account) |
| `GET` | `/api/v1/schedules` | List campaigns with pagination and filter |
| `POST` | `/api/v1/schedules` | Create a campaign, queue BullMQ jobs, and parse recipients |
| `POST` | `/api/v1/schedules/:id/cancel` | Cancel an ongoing schedule and dequeue pending jobs |
| `GET` | `/api/v1/emails/scheduled` | List upcoming scheduled email jobs |
| `GET` | `/api/v1/emails/sent` | List delivered and failed email jobs |
| `GET` | `/api/v1/emails/:id` | View job details with complete delivery attempt audit logs |
| `GET` | `/api/v1/emails/search` | Search emails with Elasticsearch and Postgres fallback |
| `POST` | `/api/v1/integrations/slack/webhook` | Connect Slack workspace via Incoming Webhook |
| `GET` | `/admin/queues` | Bull Board visual monitoring dashboard |

---

## License

This project was created as part of the ReachInbox OpenLabs technical assessment. All rights reserved.
