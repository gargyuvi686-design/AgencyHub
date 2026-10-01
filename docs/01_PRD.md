# 01 — Product Requirements Document (PRD-lite)

**Product:** AgencyHub (working name) — multi-tenant project management SaaS for agencies
**Owner:** Yuvraj Garg | **Time box:** 48h (≈12–15h focused work)

## 1. Problem
Service agencies juggle teams, clients, projects, feedback and files across scattered tools. Clients lack a clear view of progress. The SaaS owner (AppZex) needs to manage many agencies from one platform with strict data isolation.

## 2. Goals
- Each agency gets a private workspace (tenant); zero cross-tenant leakage.
- Agencies manage team, clients, projects, tasks, milestones, meetings, feedback and files.
- Clients get a simple portal: progress, deadlines, approvals, feedback, shared files/notes.
- Super Admin can list, inspect, suspend/activate agencies and enter support mode.
- One meaningful AI workflow inside a real flow.

## 3. Non-goals (cut for MVP)
Billing/payments, real email sending, real-time websockets, custom per-agency stages, SSO, mobile apps, enterprise-scale tuning.

## 4. Personas
| Persona | Goal |
|---|---|
| Super Admin | Operate the platform, support agencies, suspend bad accounts |
| Agency Admin | Run the agency: invite team, add clients, create projects |
| Agency Member | Do assigned work: tasks, meetings, respond to feedback |
| Client | Know project status, approve items, send feedback |

## 5. Scope by portal
**Super Admin (required):** platform dashboard, agency list with search/filter/pagination, agency detail stats, suspend/activate, support mode (read-only, bannered, logged), platform activity feed.

**Agency workspace:** dashboard (clients, active, due soon, completed, pending feedback, charts), team management, clients CRUD + notes + timeline, projects CRUD, milestones, tasks (status/priority/due/assignee/comments, overdue + due-this-week), meetings, feedback inbox, files, activity feed, "My Work" view.

**Client portal:** welcome, active projects with derived progress, upcoming milestones, pending approvals, recent updates (client-visible only), submit feedback, shared meeting notes, shared files.

## 6. Key product decisions
| Decision | Choice | Why |
|---|---|---|
| Progress | % of completed tasks (excl. cancelled); milestone progress shown separately | Simple, derived from real work |
| Support mode | Read-only, short-lived token, banner, logged | Safest; auditable |
| Team visibility | Members see only projects they're assigned to (via project_members) | Least privilege |
| Client approvals | Milestones can require client approval | Gives "pending client actions" real meaning |
| Visibility flag | Meetings, files, activity have `visible_to_client` (default false) | Explicit sharing |
| Membership | One user belongs to one agency | Keeps MVP simple |

## 7. AI feature: Meeting Summary → Tasks
- **Problem:** Meeting notes are long; action items get lost.
- **Input:** raw notes of one meeting (agency + project verified server-side).
- **Output:** summary, decisions, action items (title, suggested assignee name, due date).
- **Workflow:** user reviews/edits → one click converts selected action items into tasks → activity logged.
- **Failure handling:** missing key → clear 503 message; timeout 20s; invalid JSON → retry once then friendly error.

## 8. Success criteria
All checklist items in the PDF Section 20 pass; all 7 isolation scenarios return denied; deployed with seeded data for ≥2 agencies.

## 9. Extras (only if time remains, in order)
1. "My Work" view  2. Milestone client approval  3. Empty states  4. Onboarding checklist for new agency  5. AI project health
