# 06 — Build Plan & Checklist (≈ 36h window, 12–15h effort)

Rule: **cut features, never security.**

## Phase 0 — Docs & setup (0–2h)
- [ ] Finish docs 01–05, create GitHub repo, monorepo skeleton, `.gitignore`, `.env.example`
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

## Phase 3 — Super Admin (backend complete; UI browser check pending)
- [x] Stats, agency list (search/filter/paginate), detail, suspend/activate
- [x] Support mode (token, read-only guard, banner, logs), platform activity feed
- [x] Backend verification: 165 tests passing, 1 todo; scenarios 4, 6, 7, 10 covered
- [ ] Browser verification pending: manual super-admin/agency-login smoke check for suspend/activate + support mode

## Phase 4 — Agency workspace (backend complete)
- [x] Team + invite, clients CRUD, projects CRUD + members
- [x] Milestones + tasks (+comments, overdue/due-soon badges, filters)
- [x] Meetings, activity logging service, dashboard + charts, My Work
- [x] Phase 4A and 4B verified: 165 tests passing, 1 todo; scenarios 1, 2, 6, 7, 8, 10, 11 covered

## Phase 5 — Client portal (17–21h)
- [ ] Client users, portal overview, project view with derived progress
- [ ] Milestone approval, feedback + comments, shared meetings/files
- [ ] Isolation tests (3, 4, 9)

## Phase 6 — Files & feedback management (21–24h)
- [ ] Upload/download through permission check, visibility toggle
- [ ] Agency feedback inbox + status flow + responses
- [ ] Isolation test (5)

## Phase 7 — AI feature (24–28h)
- [ ] ai.service, endpoint, review UI, create-tasks, error states
- [ ] Isolation test (12)

## Phase 8 — Polish, deploy, submit (28–36h)
- [ ] Empty/loading/error states, responsive check, consistent UI
- [ ] Run all 12 isolation tests; manual pass with each demo login
- [ ] Deploy DB/API/web, seed live data, smoke test
- [ ] README complete, submission note, credentials

## Isolation scenario status (updated 2026-10-02)
- [x] 1 — Agency A -> B's project = 404
- [x] 2 — Agency A PATCH/DELETE B's task = 404, unchanged
- [ ] 3 — Client 1 -> Client 2's project = 404 (portal TODO)
- [x] 4 — Client on workspace routes = 403
- [ ] 5 — File download across agency/client = 404 (files TODO)
- [x] 6 — Suspended agency login/API = 403
- [x] 7 — Agency user on /admin/* = 403
- [x] 8 — Member on unassigned project = 404
- [ ] 9 — Client fetches non-shared meeting/file = 404 (portal TODO)
- [x] 10 — Support mode writes = 403
- [x] 11 — Create with other agency's FK = 404/422
- [ ] 12 — AI summary on other agency's meeting = 404 (AI TODO)

## Final checklist (from PDF Section 20)
- [x] Super Admin / Agency Admin / Client logins work
- [x] Multiple agencies exist; agency + client data isolated
- [x] Agency management from Super Admin
- [x] Clients & projects; tasks/milestones
- [ ] Client feedback; meetings/activity; file workflow
- [ ] AI feature works
- [ ] Deployed; repo accessible; README complete; demo credentials included
- [x] No secrets committed (check `git log -p | grep -i key`)

## Tips
- Commit small and often with meaningful messages (they review history).
- Use AI tools, but read and understand every line; be ready to explain tenant scoping and the support-mode design.
- Don't start extras until Phase 6 is passing.
