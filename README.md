# AgencyHub — Multi-Tenant Agency Project Management SaaS

> AppZex Full Stack Developer assignment submission by **Yuvraj Garg**

**AgencyHub** is a production-grade multi-tenant B2B project management platform engineered specifically for digital agencies and their clients. Built around rigorous data isolation, zero-trust tenancy boundaries, role-based workflows, and contextual AI capabilities, AgencyHub delivers dedicated portals for Super Admins, agency team members, and external clients. The system guarantees that tenant data is never commingled, unassigned projects remain invisible, and sensitive internal conversations or documents are never exposed without explicit authorization.

- **Live Application:** [https://agency-hub-nine-pink.vercel.app](https://agency-hub-nine-pink.vercel.app)
- **API Server:** [https://agencyhubapi-production.up.railway.app](https://agencyhubapi-production.up.railway.app)
- **GitHub Repository:** [https://github.com/gargyuvi686-design/AgencyHub](https://github.com/gargyuvi686-design/AgencyHub)

---

## 1. Demo Credentials

All seed accounts use the default password: **`Password123!`**

| Role | Email | Password | Target Portal | Description & Scope |
|---|---|---|---|---|
| **Super Admin** | `superadmin@agencyhub.test` | `Password123!` | `/admin` | Full platform oversight, agency suspension, and read-only support mode |
| **Agency A Admin** | `admin@acme.test` | `Password123!` | `/app` | Full administrative control of Acme Digital (clients, projects, team, tasks) |
| **Agency A Member** | `member@acme.test` | `Password123!` | `/app` | Teammate at Acme Digital; scoped strictly to assigned projects & "My Work" |
| **Agency A Client** | `client@nike.test` | `Password123!` | `/portal` | Client portal for Nike; sees shared milestones, meetings, files & feedback |
| **Agency B Admin** | `admin@apex.test` | `Password123!` | `/app` | Administrator of Apex Creative Labs (completely isolated tenant B) |
| **Agency B Member** | `member@apex.test` | `Password123!` | `/app` | Team member of Apex Creative Labs (tenant B) |
| **Suspended Admin** | `admin@suspended.test` | `Password123!` | — | **Blocked on purpose**: Returns `403 AGENCY_SUSPENDED` upon login |

---

## 2. Features by Portal

Only fully implemented and verified features are documented below:

### Super Admin Portal (`/admin`)
- **Platform Analytics:** Real-time KPI aggregate cards reporting total registered agencies, active agencies, suspended agencies, users, and projects.
- **Agency Management:** Paginated agency registry with multi-column sorting, search filters, and aggregate counts of associated users, clients, and projects.
- **Agency Suspension & Activation:** One-click suspension workflow requiring a mandatory suspension reason, instantaneously revoking active session tokens and blocking logins.
- **Support Mode (Read-Only):** Enables platform administrators to temporarily assume an agency context using a cryptographically signed, short-lived session token (30-minute expiry) to audit workspace records without write privileges.
- **Platform Audit Trail:** Centralized immutable activity log capturing cross-tenant operational events (`agency.suspended`, `agency.activated`, `support.entered`, `support.exited`).

### Agency Workspace (`/app`)
- **Executive Dashboard:** High-level metrics showing active client engagements, project progress distribution, open feedback items, recent team activity, and up to eight overdue or next-14-day task and milestone deadlines.
- **Client Directory:** Add, update, and search client organizations with primary contact details, email addresses, and associated project lists.
- **Project Management:** Create and configure client projects, allocate project managers, define budgets and delivery timelines, and assign team members.
- **Task Workflows & Milestones:** Structured task tracking supporting status states (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`), priority levels, due date tracking, and milestone deliverables with client approval gates.
- **My Work Queue:** Dedicated personalized workspace for reviewing assigned open tasks grouped into Overdue, Due this week, and Other open.
- **Agency Activity Feed:** Paginated agency activity feed, scoped to assigned projects for members.
- **Meeting Logs & Notes:** Record client meetings, store discussion notes, and toggle client visibility flags (`visible_to_client`).
- **AI Meeting Summarization & Task Extraction:** Claude-powered meeting transcription processor that summarizes discussions, lists key decisions, extracts action items with due dates, and suggests assignees.
- **Secure File Storage:** Project document repository supporting uploads up to 10 MB, magic-byte checks for PDF/PNG/JPEG/DOCX/XLSX, null-byte rejection for plain text/CSV, client visibility toggles, and streamed downloads.
- **Client Feedback Loop:** Agency-wide threaded feedback inbox with status filtering, status changes, and replies, scoped to agency and member project access.
- **Team Management:** Admin-only team screen to invite agency members with copyable accept links, review pending invitations, change roles, and confirm deactivation.

### Client Portal (`/portal`)
- **Client Overview Dashboard:** High-level view showing active projects, overall deliverable completion, upcoming milestone dates, and an attention banner when approvals or feedback replies are pending.
- **Milestone Client Approval:** Clients can approve pending milestones or request changes with a comment; decisions are recorded in the visible activity log.
- **Project Progress Tracker:** Transparent deliverable progress visualization calculated dynamically as `DONE / (all - CANCELLED)`.
- **Shared Meeting Records:** Access minutes and decisions for meetings marked with `visible_to_client = true`.
- **Shared File Repository:** Download project deliverables, creative assets, and documentation explicitly shared by the agency.
- **Feedback & Revision Submission:** Direct channel for clients to submit questions, feedback, or revision requests and follow threaded conversations across their projects.

---

## 3. Tech Stack

| Technology | Role | Rationale |
|---|---|---|
| **Next.js 14 (App Router)** | Web Frontend | Server-side rendering, layout nesting, and proxy rewrites to prevent cross-origin cookie issues |
| **Node.js & Express** | REST API Server | Fast, mature, and unopinionated backend runtime with granular middleware pipeline control |
| **TypeScript** | Language | Strict end-to-end type safety across the monorepo, eliminating contract mismatches |
| **MySQL 8** | Database | ACID-compliant relational persistence with reliable foreign key cascades, indexing, and transactions |
| **Prisma ORM** | Data Access Layer | Type-safe schema migrations, intuitive query builder, and runtime client extensions (`$extends`) |
| **Tailwind CSS & Radix UI** | UI & Components | Accessible, unstyled UI primitives paired with responsive utility-first styling |
| **Zod** | Validation | Strict schema validation for API request bodies, query params, and AI structured output |
| **Anthropic Claude 3.5 Sonnet** | AI Engine | High-accuracy reasoning model for parsing unstructured notes into structured JSON action items |
| **Turborepo & pnpm** | Monorepo Orchestration | High-speed build caching, deterministic dependency resolution, and efficient workspace tooling |
| **Vitest & Supertest** | Testing Suite | Fast test runner with native TypeScript and ESM support for comprehensive isolation suites |

---

## 4. System Architecture

### Request Pipeline
```
[ Browser / Client ]
         │  (HTTPS requests with httpOnly JWT cookies)
         ▼
[ Next.js Reverse Proxy (apps/web) ]
         │  (Rewrites /api/* to Express backend origin)
         ▼
[ Express API Router (apps/api) ]
         │
         ├─► 1. authenticate (validates JWT, rejects forged tokens)
         ├─► 2. loadAgencyStatus (verifies agency status in DB; blocks SUSPENDED accounts)
         ├─► 3. requireRole (enforces SUPER_ADMIN, AGENCY_ADMIN, AGENCY_MEMBER, CLIENT)
         ├─► 4. resolveProjectAccess (enforces member project assignments and client ownership)
         ├─► 5. Controller (validates input via Zod schemas)
         ├─► 6. Service Layer (executes business rules and audit logs)
         └─► 7. Scoped Repository & scopedPrisma (enforces WHERE agency_id = ?)
                     │
                     ▼
             [ MySQL 8 Database ]
```

### Monorepo Structure
```
AgencyHub/
├── apps/
│   ├── api/                     # Express REST API application
│   │   ├── prisma/              # Prisma schema, migrations, and seed scripts
│   │   │   ├── schema.prisma    # Full multi-tenant relational schema
│   │   │   └── seed.ts          # Seed script initializing Acme, Apex, Suspended agencies
│   │   └── src/
│   │       ├── config/          # Environment configuration & Zod env validation
│   │       ├── lib/             # Base repository, scopedPrisma extension, JWT, password
│   │       ├── middleware/      # Auth, agencyStatus, role, error, and project access guards
│   │       └── modules/         # Domain modules (auth, admin, clients, projects, tasks,
│   │                            #                 meetings, files, feedback, activity, portal)
│   └── web/                     # Next.js App Router frontend application
│       ├── app/
│       │   ├── (auth)/          # Authentication views (/login)
│       │   ├── admin/           # Super Admin portal views
│       │   ├── app/             # Agency workspace views
│       │   └── portal/          # Client portal views
│       ├── components/          # Reusable UI component library (Radix + Tailwind)
│       ├── hooks/               # Custom React hooks (auth, SWR data fetchers)
│       └── next.config.mjs      # Next.js rewrite configuration forwarding /api/* to Express
├── docs/                        # Specifications, PRD, TRD, Access Model, API Contracts
├── package.json                 # Monorepo root configuration
├── pnpm-workspace.yaml          # Workspace definitions
└── turbo.json                   # Turborepo task pipeline configuration
```

---

## 5. Multi-Tenancy & Security

AgencyHub implements defense-in-depth isolation rules:

1. **JWT-Derived Identity:** `agency_id` and `client_id` are derived solely from the cryptographically verified JWT session cookie (`token`). Tenant IDs passed in request bodies, query strings, or URL parameters are ignored and rejected.
2. **Prisma Client Extension (`scopedPrisma`):** All tenant data queries run through a customized Prisma client extension that programmatically injects `where: { agencyId }` into all `findFirst`, `findMany`, and `count` operations on operational tables (`projects`, `tasks`, `milestones`, `clients`, `meetings`, `files`, `feedback`, `activityLogs`).
3. **Disabled Unscoped Bulk Mutations:** Direct bulk `update`, `delete`, and `upsert` operations on tenant models are disabled within `scopedPrisma` to prevent accidental multi-tenant record modifications.
4. **404 Instead of 403 Policy:** Querying an ID that belongs to another agency, or an unassigned/unshared resource, returns an HTTP `404 Not Found` rather than `403 Forbidden` to prevent leaking the existence of competitor records.
5. **Dual-Key Client Isolation:** Client portal endpoints strictly require matching `client_id` and enforce `visible_to_client = true` filters on deliverables, meeting logs, and files.
6. **Per-Request Suspension Enforcement:** The `loadAgencyStatus` middleware executes on every request. If an agency's status is updated to `SUSPENDED`, all active sessions for its users immediately receive `403 AGENCY_SUSPENDED`.
7. **Read-Only Support Mode:** Super Admins entering support mode receive a short-lived (30-minute) `ah_support` cookie scoped to a single target agency. On workspace routes, support mode permits `GET` requests only; all mutating methods (`POST`, `PATCH`, `DELETE`) fail with `403 SUPPORT_READ_ONLY`.
8. **Protected Storage Pipeline:** Uploaded files are assigned random UUID storage keys and saved outside the web root. Files are never served statically; downloads stream through authenticated endpoints verifying agency ownership and client visibility before sending `Content-Disposition`.
9. **Hardened Credentials & Inputs:** Passwords hashed with `bcrypt` (cost factor 12), rate-limited authentication endpoints, generic error messages on login failures, and strict Zod validation on every endpoint.

---

## 6. Access Model & Tenancy Isolation Verification

All 12 isolation scenarios defined in `docs/02_ACCESS_AND_TENANCY.md` are backed by automated tests:

| # | Scenario Description | Target Endpoint / Action | Expected Result | Covering Test Suite | Status |
|---|---|---|---|---|---|
| **1** | Cross-Agency Project Access | Agency A Admin `GET /api/v1/projects/{B_ID}` | `404 NOT_FOUND` | `src/modules/auth/__tests__/isolation.test.ts`<br>`src/modules/projects/__tests__/project.repository.test.ts` | **Pass** |
| **2** | Cross-Agency Task Modification | Agency A Admin `PATCH /api/v1/tasks/{B_ID}` | `404 NOT_FOUND` (Row unchanged) | `src/modules/auth/__tests__/isolation.test.ts`<br>`src/modules/tasks/__tests__/task.repository.test.ts` | **Pass** |
| **3** | Cross-Client Project Access | Client 1 `GET /api/v1/portal/projects/{Client_2_Project_ID}` | `404 NOT_FOUND` | `src/modules/portal/__tests__/portal.test.ts` | **Pass** |
| **4** | Client Privilege Escalation | Client token calling `/api/v1/team` or agency routes | `403 FORBIDDEN` | `src/modules/team/__tests__/team.test.ts`<br>`src/modules/portal/__tests__/portal.test.ts`<br>`src/modules/files/__tests__/files.test.ts` | **Pass** |
| **5** | Cross-Tenant File Access | User downloading file belonging to another agency/client | `404 NOT_FOUND` | `src/modules/files/__tests__/files.test.ts` | **Pass** |
| **6** | Suspended Agency Enforcement | Suspended user login / active session API request | `403 AGENCY_SUSPENDED` | `src/modules/auth/__tests__/isolation.test.ts`<br>`src/modules/admin/__tests__/phase3a.test.ts` | **Pass** |
| **7** | Admin Route Guarding | Agency Admin or Member calling `/api/v1/admin/*` | `403 FORBIDDEN` | `src/modules/auth/__tests__/isolation.test.ts`<br>`src/modules/admin/__tests__/phase3a.test.ts` | **Pass** |
| **8** | Team Member Project Scoping | Member opening unassigned project in own agency | `404 NOT_FOUND` | `src/modules/projects/__tests__/resolveProjectAccess.test.ts`<br>`src/modules/tasks/__tests__/phase4b.test.ts` | **Pass** |
| **9** | Client Visibility Filtering | Client fetching unshared meeting or private file | `404 NOT_FOUND` (Excluded from list) | `src/modules/files/__tests__/files.test.ts`<br>`src/modules/portal/__tests__/portal.test.ts` | **Pass** |
| **10** | Support Mode Write Protection | Support mode attempting `POST`, `PATCH`, or `DELETE` | `403 SUPPORT_READ_ONLY` | `src/modules/admin/__tests__/phase3a.test.ts`<br>`src/modules/files/__tests__/files.test.ts` | **Pass** |
| **11** | Cross-Agency Task Creation | Creating a task referencing another agency's `projectId` | `404 NOT_FOUND` | `src/modules/tasks/__tests__/phase4b.test.ts`<br>`src/modules/tasks/__tests__/task.repository.test.ts` | **Pass** |
| **12** | Cross-Agency AI Summarization | Generating AI summary for another agency's meeting | `404 NOT_FOUND` (AI API not called) | `src/modules/meetings/__tests__/meeting-ai.test.ts` | **Pass** |

### Automated Test Run Summary
```
Test Files  22 passed (22)
Tests       211 passed (211)
```
> **Mutation Check Verification:** Focused mutation checks confirmed that the milestone client filter, dashboard deadline agency filter, agency/portal feedback filters, activity agency filter, and upload content validation each cause their HTTP test to fail when removed.

---

## 7. Product Decisions

1. **Project Progress Formula:** Calculated strictly as:
   $$\text{Progress} = \frac{\text{Count}(\text{Tasks with status } = \text{DONE})}{\text{Total Tasks} - \text{Count}(\text{Tasks with status } = \text{CANCELLED})}$$
   Cancelled tasks are excluded from the denominator so discontinued work items do not artificially deflate project delivery metrics.
2. **Support Mode Read-Only Rationale:** Platform Super Admins must never have the ability to alter customer data, submit client deliverables, or trigger billing/status mutations under the guise of an agency. Read-only access enables full diagnostic capability while maintaining audit integrity.
3. **Least-Privilege Member Visibility:** Agency members are scoped exclusively to projects where an explicit `ProjectMember` assignment exists. Unassigned projects remain invisible (404), ensuring confidentiality between disparate project teams within the same agency.
4. **Default Internal Visibility:** All files, meeting notes, and activity items default to `visible_to_client = false`. Deliverables and meeting notes require deliberate action by an agency team member to be shared with client stakeholders.

---

## 8. AI Feature: Meeting Summarization & Action Extraction

- **Problem:** Transforming long, unstructured client meeting transcripts into discrete project tasks is time-intensive and leads to forgotten action items and misallocated responsibilities.
- **Input:** Meeting discussion notes string and sanitized project name. Internal identifiers, competitor details, and meeting titles are omitted.
- **Output:** Strict structured JSON conforming to:
  ```json
  {
    "summary": "High-level overview of meeting discussions...",
    "decisions": ["Approved final mobile wireframes"],
    "actionItems": [
      {
        "title": "Update checkout validation schema",
        "assigneeHint": "Mark Miller",
        "dueDate": "2026-10-15"
      }
    ]
  }
  ```
- **Configurable Model:** Configured via `AI_MODEL` environment variable (defaults to `claude-3-5-sonnet-20241022`).
- **Review-Then-Create Workflow:** The AI output is persisted in `meetings.ai_summary` for review. Agency users can inspect the extracted items, modify titles and due dates, match assignees against agency teammates, and select which items to convert into tasks.
- **Resilient Error Handling:**
  - Missing `ANTHROPIC_API_KEY` returns HTTP `503 AI_NOT_CONFIGURED` without crashing; the UI displays an informative alert while preserving all other functionality.
  - Enforces a 20-second request timeout.
  - Automatically executes one retry if the model returns invalid JSON before returning a user-friendly `502 AI_ERROR`.
- **Tenant Isolation & Rate Limiting:** Meetings are retrieved exclusively via scoped repositories. Rate limits (20 AI requests per agency per hour) prevent runaway token consumption.

---

## 9. Local Setup & Installation

### Prerequisites
- Node.js 18+ or 20+
- `pnpm` (`npm install -g pnpm`)
- MySQL 8.0 running locally on port 3306

### Step-by-Step Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gargyuvi686-design/AgencyHub.git
   cd AgencyHub
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure API environment variables:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
   *(Update `apps/api/.env` with your local MySQL credentials and a 32+ character `JWT_SECRET`).*

4. **Prepare the local MySQL databases:**
   Open your MySQL terminal or client and create the development and testing databases:
   ```sql
   CREATE DATABASE agencyhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE agencyhub_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. **Run database migrations:**
   ```bash
   pnpm --filter api exec prisma migrate deploy
   ```

6. **Seed the database with demo accounts:**
   ```bash
   pnpm --filter api exec tsx prisma/seed.ts
   ```

7. **Start the development servers:**
   ```bash
   pnpm dev
   ```
   - Web application: [http://localhost:3000](http://localhost:3000)
   - API server: [http://localhost:4000](http://localhost:4000)

8. **Execute the automated test suite:**
   ```bash
   pnpm --filter api test
   # or run directly:
   cd apps/api && npx vitest run
   ```

---

## 10. Environment Variables

| Variable | Scope | Description | Default / Example |
|---|---|---|---|
| `DATABASE_URL` | API | MySQL connection string for production or development | `mysql://user:pass@localhost:3306/agencyhub` |
| `JWT_SECRET` | API | Secret key used to sign and verify authentication tokens (≥32 chars) | ` ` |
| `COOKIE_DOMAIN` | API | Domain attribute for session cookies | `localhost` |
| `CORS_ORIGIN` | API | Allowed origin URL for cross-origin requests | `http://localhost:3000` |
| `UPLOAD_DIR` | API | Path to the directory where uploaded assets are stored | `./uploads` |
| `ANTHROPIC_API_KEY` | API | Anthropic API key for Claude 3.5 Sonnet summarization | ` ` |
| `AI_MODEL` | API | Specific Claude model identifier | `claude-3-5-sonnet-20241022` |
| `PORT` | API | Port on which the Express server listens | `4000` |
| `NODE_ENV` | API | Runtime environment (`development`, `test`, `production`) | `development` |
| `API_URL` | Web | Backend API address used by Next.js server rewrites | `http://localhost:4000` |

---

## 11. Deployment Architecture

### Web Application (Vercel)
- **Root Directory:** `apps/web`
- **Framework:** Next.js
- **Environment Variable:** `API_URL` set to the live Railway backend (`https://agencyhubapi-production.up.railway.app`).
- **Proxy Rewrites:** Next.js proxies all `/api/*` calls directly to the Express service, ensuring `httpOnly` authentication cookies are set on the application origin without cross-site third-party cookie restrictions.

### API & Database (Railway)
- **Database Service:** Managed MySQL 8 container with automatic volume persistence.
- **API Service:** Node.js Express server running `apps/api`.
- **Persistent Storage:** Railway persistent volume mounted at `/data` with `UPLOAD_DIR=/data/uploads` to ensure files persist across container restarts.
- **Build & Start Pipeline:**
  ```bash
  # Build:
  pnpm --filter api build
  # Start:
  pnpm --filter api exec prisma migrate deploy && node dist/server.js
  ```

---

## 12. Known Limitations & Next Steps

1. **File Storage Infrastructure:** Uploads are currently saved to persistent local disk storage on the server volume. While robust for single-instance deployments, horizontal multi-instance scaling will require migrating the `StorageService` interface to Amazon S3 or Cloudflare R2.
2. **Email Delivery Provider:** Invitations return a copyable onboarding URL, but automatic transactional email is not configured. Production rollout can introduce a provider such as Resend, SendGrid, or AWS SES.
3. **Real-Time Synchronisation:** Screens fetch current data on load and after user actions; there are no server-pushed updates. Future iterations can add Server-Sent Events (SSE) or WebSockets for instant task board updates and comment threads.
4. **Single-Agency User Association:** Users are currently assigned to exactly one agency tenant. Multi-tenant agency switching for freelance contractors will be implemented in future phases.
