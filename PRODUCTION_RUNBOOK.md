# Production Runbook - Energy MVP v1.0

Practical operations reference: deployment, rollback, backup, monitoring, and initial production
setup. This is a runbook for whoever operates the deployed application, not a feature guide.

## 1. Deployment

### Prerequisites

- Node.js (a version compatible with Next.js 16.3.4 / React 19 - Node 20+ recommended)
- A writable filesystem path for the SQLite database file and the `storage/` uploaded-documents
  directory (both must persist across deploys/restarts - see Backup below)
- Environment variables set (see `.env.example`): `DATABASE_URL`, `SESSION_SECRET`

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `file:./path/to/prod.db` for SQLite. Point this at a persistent path, not an ephemeral container filesystem. |
| `SESSION_SECRET` | Yes | Long random string, unique to production. Generate with `openssl rand -base64 48`. Never reuse the development value. |

`NODE_ENV=production` is set automatically by `next build`/`next start` - no need to set it
manually, and doing so is what the app checks to enable secure cookies (`secure: true`) and to
refuse to run `prisma/seed.ts`.

### Database migration

```bash
npx prisma migrate deploy
```

This applies any migrations not yet applied, in order, without prompting and without generating
new migrations. It is safe to run on every deploy - already-applied migrations are skipped. Do
**not** use `prisma migrate dev` in production (it can prompt to reset the database).

### Build

```bash
npm ci
npx prisma generate
npm run build
```

### Startup

```bash
npm run start
```

Next.js listens on port 3000 by default (`-p <port>` to change, or the `PORT` env var depending on
your process manager/hosting platform).

### First-time production setup

After the first successful deploy, before inviting real users:

1. Run `npx prisma migrate deploy` (creates the schema; the database starts empty - no seed script
   runs automatically in production).
2. Create the first Owner/Admin user directly against the production database (there is no
   "first-run setup wizard" in this MVP). The simplest safe way is a one-off script using
   `bcryptjs` to hash a real, unique password and `@prisma/client` to insert the `Company` and
   first `User` row - mirroring the shape in `prisma/seed.ts` but with **real** values, run once,
   and not committed anywhere.
3. Log in as that Owner/Admin and create the rest of the real staff accounts through normal
   application usage once user-management UI exists, or by the same one-off-script approach in the
   interim.
4. Work through the "Initial Production Configuration Checklist" below.

## 2. Rollback

### Application rollback

Redeploy the previous known-good build/commit. Since this is a Next.js app with no persistent
in-memory state, rolling back the application code is safe at any time.

### Migration considerations

Prisma migrations in this project are additive only (see `PROJECT_STATE.md` - nothing has ever
been dropped or renamed). Rolling back application code to a version older than the latest
migration is **not safe** if that migration added a column/table the older code doesn't expect to
be there but also doesn't need - additive migrations are backward-compatible with older code in
practice, but this has not been mechanically verified for every migration. Treat any rollback that
crosses a migration boundary as higher-risk and test it against a copy of the production database
first if at all possible.

There is no "down" migration tooling in place. A migration that must be undone requires a new
forward migration that reverses it, or a manual, reviewed SQL change.

## 3. Backup

### Database

The entire application state (except uploaded files) lives in one SQLite file
(`DATABASE_URL`). At minimum:

- Take a copy of the database file on a regular schedule (daily, at minimum, for a pilot).
- Because SQLite is a single file, a straight file copy is a valid backup **as long as the
  application is not actively writing at that instant** - prefer the SQLite `.backup` command or
  stop the app briefly, or use your platform's filesystem-snapshot capability if available.
- Store backups somewhere other than the same disk as the live database.

### Uploaded documents

Files uploaded through the app (attachments on parties, projects, expenses, etc.) are stored on
local disk under `storage/` (see `src/lib/core/storage/local-disk.ts`), referenced by the
`Document` table. Back up this directory alongside the database - a database backup without the
matching `storage/` contents leaves every attachment link broken.

### Recovery

To restore: stop the application, replace the database file and `storage/` directory with the
backed-up copies (taken from the same point in time), then start the application again. There is
no automated restore tooling - this is a manual procedure. Test it at least once against a
non-production copy before relying on it.

**This MVP does not implement automated backups, off-site replication, or point-in-time recovery.**
Those are the operator's responsibility to set up using their hosting platform's tooling (managed
database snapshots, cron + off-site storage, etc.) - do not assume disaster recovery exists just
because this document describes what it should cover.

## 4. Monitoring

This MVP does not include an APM/error-tracking integration. At minimum for a pilot:

- Monitor the process itself (is `next start` still running / responding to requests).
- Watch application logs (stdout/stderr) for unhandled errors - Next.js logs server-side errors
  there by default.
- Periodically check the in-app **Recent Activity** feed (Dashboard) and each module's own audit
  trail as a manual proxy for "is data changing as expected."
- There are no background jobs/queues in this MVP, so there is nothing else to monitor for failed
  job processing.

## 5. Emergency Response

- **Disable a broken feature**: there is no feature-flag system. The fastest safe mitigation for a
  broken workflow is usually restricting the relevant role's permission (in
  `src/lib/core/permissions.ts`) and redeploying, or rolling back the application entirely if the
  defect is severe (see Rollback above).
- **Preserve logs**: capture server logs and the output of the failing request before restarting
  the process, if the platform doesn't already retain them.
- **Restore from backup**: only for data corruption/loss - see Backup/Recovery above. Restoring
  from backup loses any writes since that backup; treat it as a last resort.
- **Cross-tenant or auth incident**: rotate `SESSION_SECRET` immediately (this invalidates every
  active session, forcing re-login) and investigate before restoring access.

## 6. Initial Production Configuration Checklist

Before Shanvi starts using the system for real business:

- [ ] **Company**: confirm the `Company` record's legal name is correct (the MVP does not yet have
      a company-profile edit screen for address/logo/tax details beyond what Settings exposes).
- [ ] **Users**: create one account per real staff member, each with their own password, assigned
      the correct role (see `src/lib/core/roles.ts` for the 8 available roles). Disable/remove the
      development seed accounts (`owner@shanvienterprises.com` etc., shared password
      the shared password documented in `prisma/seed.ts`) - do not let real staff log in with those.
  - [ ] **Do not enable `db:seed` against this database again** - it would recreate the
        shared-password accounts (blocked by default in production unless
        `ALLOW_DEV_SEED=true` is explicitly set - leave that unset).
- [ ] **Customers / Vendors**: enter Shanvi's real customer and vendor master data (Parties module)
      - do not carry over any demo party.
- [ ] **Products**: enter Shanvi's real product/equipment master data. Reuse or edit the seeded
      Categories/Brands/Units (these are genuine reference master data, not demo data - see
      `prisma/seed.ts`) as needed for the real catalogue.
- [ ] **Inventory locations**: confirm/add Shanvi's actual warehouse(s) beyond the seeded
      "Main Warehouse".
- [ ] **Opening inventory**: see below.
- [ ] **Expense categories**: add/edit under Settings → Expense Categories to match Shanvi's real
      cost categories.
- [ ] **Existing receivables/payables/advances**: see below.

### Opening inventory

If Shanvi already holds physical stock, enter it through a normal stock-in movement (Inventory →
Stock → adjust/opening stock), which correctly creates an auditable `StockMovement` row via
`applyStockMovement`. **Do not** fabricate a Purchase Order/Purchase Receipt purely to create
opening stock - that would misrepresent a real procurement event that never happened.

### Existing receivables / payables / advances

If Shanvi has real outstanding customer receivables, vendor payables, or customer/vendor advances
from before go-live, there is no dedicated "opening balance" import in this MVP. The auditable way
to represent them:

- **Existing customer receivable**: create the real Invoice for the historical sale (with its
  original date if the UI allows backdating the invoice date) so it flows through the normal
  Receivables/Ledger machinery.
- **Existing vendor payable**: same, via a Vendor Invoice.
- **Existing customer advance**: record it as a Customer Payment with no allocation (an
  "unallocated" payment) - the existing mechanism already supports this and it will show as
  available advance balance.
- **Existing vendor advance**: same, via a Vendor Payment with no allocation.

Do **not** directly edit a balance field in the database to force a number to match - every balance
in this system is derived from real rows (invoices, payments, allocations), and bypassing that
breaks the reconciliation guarantees documented in `MVP_BASELINE.md`.

### Data import

There is no bulk-import system in this MVP (deliberately - see `MVP_BASELINE.md` out-of-scope
list). For a pilot's initial data load, enter customers/vendors/products/opening stock through the
normal UI. If the volume genuinely requires bulk loading, that is a `POST_MVP_BACKLOG.md` item, not
something to build ad hoc during handoff.
