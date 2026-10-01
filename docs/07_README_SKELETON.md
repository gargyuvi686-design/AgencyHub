# AgencyHub — Multi-Tenant Agency Project Management SaaS

> AppZex Full Stack Developer assignment submission by Yuvraj Garg

**Live URL:** <add>  |  **API:** <add>  |  **Repo:** <add>

## Demo credentials
| Role | Email | Password |
|---|---|---|
| Super Admin | | |
| Agency A Admin | | |
| Agency A Member | | |
| Agency A Client | | |
| Agency B Admin | | |
| Agency B Client | | |

## Features
<short list per portal>

## Tech stack
Next.js, Node.js/Express, MySQL, Prisma, ... (why each)

## Architecture
<diagram + layering + folder structure>

## Multi-tenancy & security
- How `agency_id` is enforced (scoped Prisma extension + repos)
- Client isolation (client_id + visible_to_client)
- 404-instead-of-403 policy
- File protection
- Suspension handling
- Password hashing, rate limiting, validation
- Isolation test results (table of 12 scenarios → pass)

## Product decisions
Progress calculation · Support mode (read-only, why) · Team visibility · Client approvals · Sharing flags

## AI feature
Problem · Input · Output · Model/API · Workflow · Error handling · Tenant isolation

## Setup
```bash
git clone <repo> && cd agencyhub
cp apps/api/.env.example apps/api/.env
# Ensure MySQL 8 is running locally and database 'agencyhub' is created
cd apps/web && npm i && npm run dev
```

## Environment variables
<table from TRD §10; never commit real keys>

## Database
Schema overview, migrations, seeding

## Running tests
`npm run test` (isolation suite)

## Known limitations & next steps
<submission note: shortcuts taken, what to build next>
