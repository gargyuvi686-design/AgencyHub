# 06 — Build Plan & Checklist (status verified 2026-10-02)

Rule: **cut features, never security.**

## Phase 0 — Docs & setup
- [x] Docs 01–05, GitHub repo, monorepo skeleton, `.gitignore`, `.env.example`
- [x] Prisma schema + first migration, MySQL running locally

## Phase 1 — Auth & roles (2–5h)
- [x] User model, bcrypt, login/logout/me, JWT cookie
- [x] `authenticate`, `requireRole`, error handler, zod helper
- [x] Seed: super admin + 2 agencies + users
- [x] Next.js login page + role-based redirect (/admin, /app, /portal)

## Phase 2 — Tenant architecture (5–7h)
- [x] `scopedPrisma` extension + repos pattern
- [x] Agency status check (suspended block)
- [x] First isolation tests (scenarios 1, 2, 6, 7)

## Phase 3 — Super Admin
- [x] Stats, agency list (search/filter/paginate), detail, suspend/activate
- [x] Support mode (token, read-only guard, banner, logs), platform activity feed
- [x] Full API verification: 211 tests passing; scenarios 4, 6, 7, 10 covered
- [ ] Browser verification pending: manual super-admin/agency-login smoke check for suspend/activate + support mode

## Phase 4 — Agency workspace
- [x] Team + invite, clients CRUD, projects CRUD + members
- [x] Milestones + tasks (+comments, overdue/due-soon badges, filters, client approval controls)
- [x] Meetings, agency activity feed, dashboard deadlines + charts, My Work, feedback inbox
- [x] Full API verification: 211 tests passing; scenarios 1, 2, 6, 7, 8, 10, 11 covered

## Phase 5 — Client portal
- [x] Client users, portal overview, project view with derived progress and attention banner
- [x] Milestone approval, feedback + comments, shared meetings/files
- [x] Isolation tests (3, 4, 9), plus milestone approval ownership and decision tests

## Phase 6 — Files & feedback management
- [x] Upload/download permission checks, visibility toggle, magic-byte checks, and text null-byte rejection
- [x] Agency feedback inbox + status flow + threaded responses
- [x] Isolation test (5) and content-mismatch HTTP tests

## Phase 7 — AI feature
- [x] AI service, endpoint, review UI, task creation, and error states
- [x] Isolation test (12)

## Phase 8 — Polish, deploy, submit
- [x] TypeScript checks, lint, clean web production build, and full API test suite
- [ ] Manual browser smoke check with each demo login
- [ ] Deploy DB/API/web, seed live data, and smoke test
- [x] README feature/limitation summary, test count, and demo credentials

## Isolation scenario status (updated 2026-10-02)
- [x] 1 — Agency A -> B's project = 404
- [x] 2 — Agency A PATCH/DELETE B's task = 404, unchanged
- [x] 3 — Client 1 -> Client 2's project = 404
- [x] 4 — Client on workspace routes = 403
- [x] 5 — File download across agency/client = 404
- [x] 6 — Suspended agency login/API = 403
- [x] 7 — Agency user on /admin/* = 403
- [x] 8 — Member on unassigned project = 404
- [x] 9 — Client fetches non-shared meeting/file = 404
- [x] 10 — Support mode writes = 403
- [x] 11 — Create with other agency's FK = 404/422
- [x] 12 — AI summary on other agency's meeting = 404

## Final checklist (from PDF Section 20)
- [x] Super Admin / Agency Admin / Client login and role guards verified by HTTP tests
- [x] Multiple agencies exist; agency + client data isolated
- [x] Agency management from Super Admin
- [x] Clients & projects; tasks/milestones and client approvals
- [x] Client feedback; meetings/activity; file workflow
- [x] AI feature covered by API tests
- [ ] Deployed; manual browser verification pending; repo and demo credentials documented
- [x] No secrets committed (check `git log -p | grep -i key`)

## Tips
- Commit small and often with meaningful messages (they review history).
- Use AI tools, but read and understand every line; be ready to explain tenant scoping and the support-mode design.
- Don't start extras until Phase 6 is passing.
