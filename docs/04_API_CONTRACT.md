# 04 — API Contract (REST, JSON)

Base: `/api/v1`. Auth: httpOnly cookie `token`. Errors: `{ "error": { "code": "...", "message": "..." } }`.
Status codes: 400/422 validation, 401 unauthenticated, 403 forbidden role/suspended, 404 not found or not yours.
List endpoints: `?page=&limit=&q=&status=` → `{ data: [], meta: { page, limit, total } }`.

## Auth (public)
| Method | Path | Notes |
|---|---|---|
| POST | /auth/login | rate-limited; blocks suspended agency users |
| POST | /auth/logout | clears cookie |
| GET | /auth/me | user + agency + support-mode info |
| POST | /auth/register-agency | creates agency + admin (onboarding) |
| POST | /auth/accept-invite | set password from invite token |

## Super Admin — role SUPER_ADMIN → `/admin`
| Method | Path | Notes |
|---|---|---|
| GET | /admin/stats | totals, active/inactive, users, clients, projects |
| GET | /admin/agencies | search q, filter status, pagination, counts |
| GET | /admin/agencies/:id | details + stats |
| PATCH | /admin/agencies/:id/status | ACTIVE/SUSPENDED + reason; logged |
| POST | /admin/agencies/:id/support-session | issues short-lived read-only token; logged |
| POST | /admin/support-session/exit | logged |
| GET | /admin/activity | platform activity feed |

## Agency workspace — roles AGENCY_ADMIN, AGENCY_MEMBER (support mode = GET only)
| Method | Path | Admin | Member |
|---|---|---|---|
| GET | /dashboard | ✓ | ✓ (own scope) |
| GET | /my-work | ✓ | ✓ |
| GET/POST | /team | ✓ | — |
| PATCH/DELETE | /team/:userId | ✓ | — |
| POST | /team/invite | ✓ | — |
| GET/POST | /clients | ✓ | read |
| GET/PATCH/DELETE | /clients/:id | ✓ | read |
| POST | /clients/:id/portal-users | ✓ | — |
| GET/POST | /projects | ✓ | read assigned |
| GET/PATCH/DELETE | /projects/:id | ✓ | read/limited |
| PUT | /projects/:id/members | ✓ | — |
| GET/POST | /projects/:id/milestones | ✓ | ✓ |
| PATCH/DELETE | /milestones/:id | ✓ | ✓ |
| GET/POST | /projects/:id/tasks | ✓ | ✓ |
| GET/PATCH/DELETE | /tasks/:id | ✓ | ✓ |
| GET/POST | /tasks/:id/comments | ✓ | ✓ |
| GET/POST | /projects/:id/meetings | ✓ | ✓ |
| PATCH/DELETE | /meetings/:id | ✓ | ✓ |
| GET | /projects/:id/feedback | ✓ | ✓ |
| PATCH | /feedback/:id | status | ✓ |
| GET/POST | /feedback/:id/comments | ✓ | ✓ |
| GET/POST | /projects/:id/files | ✓ | ✓ |
| PATCH | /files/:id | toggle visible_to_client | ✓ |
| GET | /files/:id/download | permission-checked stream | ✓ |
| DELETE | /files/:id | ✓ | uploader |
| GET | /projects/:id/activity | ✓ | ✓ |
| GET | /clients/:id/activity | ✓ | ✓ |

## AI
| Method | Path | Notes |
|---|---|---|
| POST | /meetings/:id/ai-summary | returns/stores summary, decisions, action_items |
| POST | /meetings/:id/ai-summary/create-tasks | body: selected action items (reviewed by user) → creates tasks |

## Client portal — role CLIENT → `/portal`
| Method | Path | Notes |
|---|---|---|
| GET | /portal/overview | welcome, projects, upcoming milestones, pending actions |
| GET | /portal/projects | own client's projects only |
| GET | /portal/projects/:id | progress, milestones, client-visible updates |
| POST | /portal/milestones/:id/approve | approve or request changes |
| GET/POST | /portal/projects/:id/feedback | submit + list own |
| GET/POST | /portal/feedback/:id/comments | conversation |
| GET | /portal/projects/:id/meetings | shared only |
| GET | /portal/projects/:id/files | shared only |
| GET | /portal/files/:id/download | shared only, permission-checked |

## Validation
All bodies/params/queries validated with zod; reject unknown fields; IDs must be UUIDs; file uploads: max 10 MB, allow-listed MIME types.
