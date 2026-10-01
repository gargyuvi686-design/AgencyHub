# 06 — Build Plan & Checklist (≈ 36h window, 12–15h effort)

Rule: **cut features, never security.**

## Phase 0 — Docs & setup (0–2h)
- [ ] Finish docs 01–05, create GitHub repo, monorepo skeleton, `.gitignore`, `.env.example`
- [x] Prisma schema + first migration, MySQL running locally

## Phase 1 — Auth & roles (2–5h)
- [ ] User model, bcrypt, login/logout/me, JWT cookie
- [ ] `authenticate`, `requireRole`, error handler, zod helper
- [ ] Seed: super admin + 2 agencies + users
- [ ] Next.js login page + role-based redirect (/admin, /app, /portal)

## Phase 2 — Tenant architecture (5–7h)
- [ ] `scopedPrisma` extension + repos pattern
- [ ] Agency status check (suspended block)
- [ ] First isolation tests (scenarios 1, 2, 6, 7)

## Phase 3 — Super Admin (7–10h)
- [ ] Stats, agency list (search/filter/paginate), detail, suspend/activate
- [ ] Support mode (token, read-only guard, banner, logs), platform activity feed

## Phase 4 — Agency workspace (10–17h)
- [ ] Team + invite, clients CRUD, projects CRUD + members
- [ ] Milestones + tasks (+comments, overdue/due-soon badges, filters)
- [ ] Meetings, activity logging service, dashboard + charts, My Work

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

## Final checklist (from PDF Section 20)
- [ ] Super Admin / Agency Admin / Client logins work
- [ ] Multiple agencies exist; agency + client data isolated
- [ ] Agency management from Super Admin
- [ ] Clients & projects; tasks/milestones
- [ ] Client feedback; meetings/activity; file workflow
- [ ] AI feature works
- [ ] Deployed; repo accessible; README complete; demo credentials included
- [ ] No secrets committed (check `git log -p | grep -i key`)

## Tips
- Commit small and often with meaningful messages (they review history).
- Use AI tools, but read and understand every line; be ready to explain tenant scoping and the support-mode design.
- Don't start extras until Phase 6 is passing.
