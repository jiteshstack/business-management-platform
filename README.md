# Business Management Platform - Energy Solutions MVP

A modular, multi-tenant business management platform. The currently active vertical is **Energy
Solutions**, built for **Shanvi Enterprises**: customer management, Energy quotations, sales,
invoicing, collections, procurement, inventory, vendor payables, projects, installations,
warranty, AMC, maintenance, expenses, profitability, and management reporting.

This is **Energy MVP v1.0** - feature-frozen for controlled Shanvi Enterprises UAT/pilot. See
`MVP_BASELINE.md` for exactly what's in scope and what deliberately isn't.

## Documentation map

- **`MVP_BASELINE.md`** - frozen product scope, included modules, workflows, architecture.
- **`PROJECT_STATE.md`** - detailed technical history: what was built in each phase, why, and the
  architectural decisions behind it.
- **`SHANVI_UAT_CHECKLIST.md`** - business-user acceptance testing checklist (not technical).
- **`PRODUCTION_RUNBOOK.md`** - deployment, rollback, backup, monitoring, initial production setup.
- **`POST_MVP_BACKLOG.md`** - future ideas kept out of the frozen MVP scope.

## Technology stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4
- [Prisma](https://www.prisma.io) 6 ORM on SQLite (development and current deployment target)
- Custom JWT session authentication (`jose`), bcrypt password hashing
- Zod for form/server-action validation

## Local setup

```bash
npm install
cp .env.example .env
# edit .env - set SESSION_SECRET to a long random value (see .env.example for how)
npx prisma migrate dev
npm run db:seed   # optional: creates a development company + one login per role
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If you ran `db:seed`, log in with any of the
role-based accounts it prints (all share one development password) - see `prisma/seed.ts` for the
full list. **Never use those accounts or that password in production** - `prisma/seed.ts` refuses
to run when `NODE_ENV=production`.

## Environment variables

See `.env.example` for the full list with explanations. In short:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite connection string |
| `SESSION_SECRET` | Signs/verifies session JWTs - must be long, random, and unique per environment |

## Database & migrations

Schema lives in `prisma/schema.prisma`; history lives in `prisma/migrations/`. Migrations are
additive only across this project's history - nothing has been dropped or renamed.

```bash
npx prisma migrate dev --name <description>   # create + apply a new migration (development)
npx prisma migrate deploy                     # apply pending migrations (production - see PRODUCTION_RUNBOOK.md)
npx prisma studio                             # browse the database
```

## Development commands

```bash
npm run dev          # start the dev server (Turbopack)
npm run build        # production build
npm run start        # run a production build
npm run lint         # ESLint
npx tsc --noEmit     # typecheck
```

## Testing

There is no committed automated test suite in this repository. Every phase of development was
validated with a combination of `tsc --noEmit`, `npm run lint`, `npm run build`, and hands-on
functional/security testing (tenant isolation, RBAC, financial reconciliation) driven through the
real UI - see `PROJECT_STATE.md` for what was verified in each phase, and
`SHANVI_UAT_CHECKLIST.md` for the business-facing acceptance checklist used before this freeze.

## Production build & deployment

See `PRODUCTION_RUNBOOK.md` for the full deployment procedure, environment configuration,
rollback approach, and backup requirements. In short:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## Known limitations

See the "Known Limitations" sections throughout `PROJECT_STATE.md` (per phase) and the Financial
Disclaimer in `MVP_BASELINE.md`. Most notably: this is **not** a statutory accounting system, and
project/customer profitability figures are estimates based on a single purchase-price point per
product, not weighted-average or FIFO inventory costing.
