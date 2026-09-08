# Audit Log and Manual Case Status Improvements

## Implemented

- Added a system-wide `audit_logs` table and admin-only Audit Log screen.
- Records successful and failed local login attempts, case creation and updates, case status changes, assignments, document uploads/downloads, PDF exports, and report access.
- Sensitive request fields such as passwords and tokens are redacted before audit storage.
- Extended `case_action_logs` with action type, previous status, new status, and changed-field details.
- Case status is now controlled manually:
  - **Save Draft** always creates a `Draft` case.
  - Normal creation uses the selected `Open` or `Closed` status.
  - Closing requires a closure reason and automatically records the closure date.
  - Assignment changes no longer change case status.
  - The separate fraud-officer Decisions step has been removed; status is controlled only from Case Overview.
  - Existing closed cases can be reopened from **Case Overview** by selecting `Open`.
- The local `admin` role is recognized as the System Administrator and receives `permissions: ["*"]` plus `canManageSecurity: true`.

## Database deployment

The backend automatically attempts to create/upgrade the audit tables at startup. A database administrator can alternatively run the matching migration manually:

- MSSQL: `backend/migration_audit_manual_status_mssql.sql`
- PostgreSQL: `backend/migration_audit_manual_status_postgres.sql`

## Restore configured local login passwords

From the `backend` folder, run this once against the target database:

```bash
npm install
npm run reset-local-users
```

This reads `LOCAL_AUTH_USERS` from `backend/.env`, creates missing users, activates them, and resets their password hashes to the configured passwords. It does not permanently enable password reset on every application restart.

## Verification completed

- Backend JavaScript syntax checks passed.
- Frontend TypeScript and Vite production build passed.
- Live database verification was not possible from the build environment because the configured MSSQL endpoint is `localhost:14330` and was not running there.
