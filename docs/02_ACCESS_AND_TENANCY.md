# 02 — Access Model & Tenancy Rules (most important doc)

## 1. Roles
`SUPER_ADMIN`, `AGENCY_ADMIN`, `AGENCY_MEMBER`, `CLIENT`

| Role | agency_id | client_id | Lives in |
|---|---|---|---|
| SUPER_ADMIN | null | null | /admin portal |
| AGENCY_ADMIN | set | null | /app workspace |
| AGENCY_MEMBER | set | null | /app workspace |
| CLIENT | set | set | /portal |

## 2. Permission matrix
| Action | Super Admin | Agency Admin | Member | Client |
|---|---|---|---|---|
| List/manage agencies | ✓ | — | — | — |
| Suspend/activate agency | ✓ | — | — | — |
| Enter support mode (read-only) | ✓ | — | — | — |
| Invite/manage team & roles | — | ✓ | — | — |
| Create/edit clients | — | ✓ | — | — |
| Create/edit projects | — | ✓ | — | — |
| Assign project members | — | ✓ | — | — |
| Create/update tasks & milestones | — | ✓ | ✓ (assigned projects) | — |
| Record meetings, set sharing | — | ✓ | ✓ (assigned) | — |
| Respond to feedback | — | ✓ | ✓ (assigned) | — |
| Upload files, set sharing | — | ✓ | ✓ (assigned) | Own feedback only |
| Submit feedback / comment | — | — | — | ✓ own projects |
| Approve milestone | — | — | — | ✓ own projects |
| View projects | read-only in support mode | all in agency | assigned only | own client's only |
| View meetings/files | read-only in support mode | all in agency | assigned only | shared only |

## 3. Tenancy rules (non-negotiable)
1. Every operational table carries `agency_id` (NOT NULL, indexed).
2. `agency_id` and `client_id` come from the **verified JWT/session**, never from request body, query or URL.
3. All tenant queries go through a **scoped repository / Prisma extension** that injects `agency_id`. Raw unscoped queries on tenant tables are forbidden outside seed/admin code.
4. Fetch by ID always uses `WHERE id = ? AND agency_id = ?` (and `client_id = ?` for clients). A miss returns **404**, never 403, to avoid leaking existence.
5. Child resources are validated through their parent (task → project → agency); creating a task verifies the project belongs to the caller's agency.
6. Foreign keys supplied by the user (client_id, assignee_id, project_id) are verified to be in the same agency before saving.
7. Clients: additionally filtered by `client_id`, and only `visible_to_client = true` items.
8. Super Admin has no agency_id; tenant routes reject Super Admin tokens unless they carry a support-mode claim, and in support mode only GET is allowed.
9. Every request loads agency status; `SUSPENDED` → 403 with message "This agency account is suspended." Login is also blocked.
10. Files are never served statically; downloads go through `GET /files/:id/download` with the same checks. Storage keys are random UUIDs.
11. AI endpoints load data only via scoped repositories; the prompt never contains other tenants' data.
12. Passwords hashed with bcrypt (cost 12). Rate-limit login. Generic login error message.

## 4. Middleware chain
`authenticate → loadAgencyStatus → requireRole([...]) → resolveProjectAccess (members/clients) → controller → scoped repo`

## 5. Test scenarios (write as automated tests)
| # | Scenario | Expected |
|---|---|---|
| 1 | Agency A admin GET /projects/{B's id} | 404 |
| 2 | Agency A user PATCH /tasks/{B's id} | 404, no change |
| 3 | Client 1 GET /portal/projects/{Client 2's id} | 404 |
| 4 | Client calls /api/team or any agency route | 403 |
| 5 | Open file download of other agency/client | 404 |
| 6 | Suspended agency user logs in / calls API | 403 + message |
| 7 | Agency user calls /admin/* | 403 |
| 8 | Member opens unassigned project in own agency | 404 |
| 9 | Client fetches non-shared file/meeting | 404 |
| 10 | Support mode attempts POST/PATCH/DELETE | 403 |
| 11 | Create task with other agency's project_id | 404/422 |
| 12 | AI summary on other agency's meeting | 404 |
