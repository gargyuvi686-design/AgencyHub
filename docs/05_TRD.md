# 05 — Technical Requirements Document (TRD-lite)

## 1. Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, react-hook-form + zod, Recharts |
| Backend | Node.js 20, Express, TypeScript |
| DB | MySQL 8 |
| ORM | Prisma (with client extension for tenant scoping) |
| Auth | JWT in httpOnly cookie, bcrypt (cost 12) |
| Validation | zod |
| Security | helmet, cors (strict origin), express-rate-limit, multer (uploads) |
| Logging | pino |
| AI | Anthropic Claude API via `@anthropic-ai/sdk`; model in env `AI_MODEL` |
| Tests | Vitest + supertest (isolation tests) |
| Deploy | Frontend: Vercel · Backend + MySQL: Railway (or Render + Aiven) |

## 2. Architecture
```
Browser → Next.js (UI, route groups per portal)
            │  rewrites /api/* → backend (same-origin cookies)
            ▼
        Express API
   routes → middleware → controllers → services → scoped repositories → Prisma → MySQL
                                   └→ storage service (files)   └→ ai service (Claude)
```
- **Why rewrites:** the browser only talks to the Next.js origin, so httpOnly cookies work without cross-site SameSite hassle.
- **Layering:** controllers parse/validate and return; services hold business rules and activity logging; repositories are the only place that touches Prisma.

## 3. Repo structure (monorepo)
```
agencyhub/
  apps/
    web/                     # Next.js
      app/(auth)/login
      app/admin/...          # Super Admin portal
      app/app/...            # Agency workspace
      app/portal/...         # Client portal
      components/ lib/ hooks/
    api/
      src/
        config/ (env.ts)
        middleware/ (authenticate, tenant, requireRole, support, errorHandler, rateLimit)
        modules/
          auth/ admin/ agencies/ team/ clients/ projects/
          milestones/ tasks/ meetings/ feedback/ files/
          activity/ ai/ portal/
          (each: routes.ts, controller.ts, service.ts, repo.ts, schema.ts)
        lib/ (prisma.ts, scopedPrisma.ts, storage.ts, logger.ts, errors.ts)
        prisma/ (schema.prisma, seed.ts, migrations/)
      tests/ (isolation.test.ts)
  docs/
  README.md
```

## 4. Auth flow
1. `POST /auth/login` → check email, bcrypt compare, check `is_active`, load agency; if `SUSPENDED` → 403 message.
2. Issue JWT `{ sub, role, agencyId, clientId }`, 8h expiry, cookie `httpOnly; Secure; SameSite=Lax`.
3. `authenticate` middleware verifies JWT and re-loads user + agency status from DB each request (so suspension is instant).
4. Support mode: Super Admin calls `/admin/agencies/:id/support-session` → new JWT with `{ role: SUPER_ADMIN, supportAgencyId, mode: "support" }`, 30 min expiry. `supportGuard` allows only GET on workspace routes and scopes data to `supportAgencyId`. Frontend shows a banner with Exit button.

## 5. Tenant scoping implementation
- `scopedPrisma(ctx)` returns a Prisma client extended so that for tenant models: `findMany/findFirst/count/aggregate` add `agencyId`; `create` sets `agencyId`; `update/delete` use `updateMany/deleteMany` with `agencyId` in `where` and check `count === 1`.
- Controllers never receive the raw Prisma client — only repos built from `scopedPrisma(ctx)`.
- Client-facing repos add `clientId` and `visibleToClient: true` filters.
- Member-facing project repos filter via `project_members`.
- Isolation tests run in CI/local before deploy.

## 6. File handling
- Upload via multer to memory/temp → validate size (≤10 MB) and MIME allow-list → store with random UUID key through `StorageService` interface (`LocalDiskStorage` on a Railway volume for MVP; swap to S3/R2 later).
- Files directory is **not** publicly served.
- Download: `GET /files/:id/download` → load file scoped by agency (+ client visibility) → stream with `Content-Disposition`. 404 on any mismatch.

## 7. AI service
- `ai.service.ts`: builds prompt from the meeting (loaded through scoped repo) + project name only. Requests strict JSON: `{ summary, decisions[], actionItems[{title, assigneeHint, dueDate}] }`.
- 20s timeout, one retry on invalid JSON, zod-validate output.
- Missing `ANTHROPIC_API_KEY` → 503 `AI_NOT_CONFIGURED`; UI shows friendly message and hides nothing else.
- Output stored in `meetings.ai_summary`; tasks created only after user confirms; assignee matched against agency users by name, else unassigned.
- Per-agency rate limit (e.g. 20 AI calls/hour).

## 8. Activity logging
`activity.service.log({ ctx, eventType, entity, projectId, visibleToClient, metadata })` is called from services (not controllers) so every mutation records an event. Super Admin actions write platform-level events.

## 9. Error handling & validation
Central `errorHandler`; custom `AppError(code, status, message)`; zod errors → 422 with field details; never leak stack traces in production.

## 10. Environment variables
```
# api
DATABASE_URL=mysql://user:pass@host:3306/agencyhub
JWT_SECRET=
COOKIE_DOMAIN=
CORS_ORIGIN=
UPLOAD_DIR=/data/uploads
ANTHROPIC_API_KEY=
AI_MODEL=
PORT=4000
# web
API_URL=http://localhost:4000
```
`.env` is git-ignored; commit only `.env.example`.

## 11. Performance basics
Indexes on `agency_id` and FK columns; pagination everywhere; dashboard stats via grouped aggregate queries, not N+1.

## 12. Deployment
1. Provision MySQL → set `DATABASE_URL`.
2. Deploy API (build → `prisma migrate deploy` → seed once → start).
3. Deploy web with `API_URL` pointing at the API.
4. Smoke test all 3 logins + the isolation scenarios on the live URL.

## 13. Known trade-offs (for submission note)
Local-disk storage instead of S3; no email sending (invites show a copyable link); single agency per user; no websockets (polling/refetch).
