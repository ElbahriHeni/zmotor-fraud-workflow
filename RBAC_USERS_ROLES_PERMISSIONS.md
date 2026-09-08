# Users, Roles, and Permissions Module

## Security model

The application now uses database-backed role-based access control (RBAC):

```text
User → Role → Role Permissions
             + User-specific Allow overrides
             - User-specific Deny overrides
             = Effective Permissions
```

The System Administrator role always has full access and cannot be restricted through overrides.

## Database objects

The backend creates or upgrades these structures during startup:

- `roles`
- `permissions`
- `role_permissions`
- `user_permission_overrides`
- Additional security columns in `app_users`, including `role_id`, `auth_provider`, `must_change_password`, `token_version`, and `last_login_at`

Existing users are migrated as follows:

- Legacy `admin` users → **System Administrator**
- Other legacy users → **Fraud Investigator**

No existing user or password hash is deleted.

## Seeded roles

### System Administrator

Full access to all modules, users, roles, permissions, and audit data.

### Fraud Manager

Operational access to cases, assignments, statuses, documents, reports, exports, and read-only access to the user list.

### Fraud Investigator

Can create and investigate cases, change case status, manage supporting documents, export case PDFs, and view reports.

### Auditor / Read Only

Read-only access to cases, documents, reports, exports, and audit evidence.

## Permission catalogue

### Dashboard

- `dashboard.view`

### Cases

- `cases.view`
- `cases.create`
- `cases.update`
- `cases.change_status`
- `cases.assign`
- `cases.upload_documents`
- `cases.download_documents`
- `cases.export_pdf`

### Reports

- `reports.view`
- `reports.export`

### Users

- `users.view`
- `users.create`
- `users.update`
- `users.activate`
- `users.reset_password`
- `users.manage_permissions`

### Roles

- `roles.view`
- `roles.create`
- `roles.update`
- `roles.manage_permissions`

### Audit

- `audit.view`

## Screens

- `/app/users` — list and filter users
- `/app/users/new` — create a local or Microsoft AD user
- `/app/users/:id` — edit profile, role, status, password, and permission overrides
- `/app/roles` — list roles
- `/app/roles/new` — create a configurable role
- `/app/roles/:id` — edit role and permission matrix
- `/app/change-password` — change the current local user's password

The sidebar and action buttons are permission-aware, but all important controls are also enforced by the backend API.

## Authentication behavior

### Local accounts

- Passwords are hashed using bcrypt.
- Administrators set a temporary password.
- `must_change_password` forces the user to change it after login.
- Password reset and account activation changes invalidate existing sessions through `token_version`.

### Microsoft AD accounts

- The application authorizes an existing Microsoft account; it does not create the Microsoft identity.
- Passwords remain managed by Microsoft.
- The account must exist in `app_users`, be active, use `auth_provider = 'ad'`, and have an active application role.

## Safety rules

- A user cannot deactivate their own account.
- The last active System Administrator cannot be deactivated or moved to another role.
- Only a System Administrator can create, update, deactivate, or reset another System Administrator.
- System Administrator permissions cannot be reduced.
- A non-System Administrator cannot grant a permission they do not possess.
- Users are deactivated rather than physically deleted.
- Passwords and hashes are never returned by user APIs.
- User, role, permission, password, and login events are recorded in the Audit Log.

## Recommended local test

1. Start the backend and confirm `/api/health` is healthy.
2. Sign in as `admin@arabianshield.com`.
3. Open **Role Management** and review the seeded roles.
4. Create a test role with only Dashboard and View Cases.
5. Create a local test user with that role and a temporary password.
6. Sign out and sign in as the test user.
7. Confirm the mandatory password-change screen appears.
8. Confirm the user sees only authorized menu entries and receives HTTP 403 for unauthorized direct API calls.
9. Sign back in as administrator, deactivate the test user, and confirm its existing session becomes invalid.
10. Review all actions in the Audit Log.

## Database deployment

The backend auto-migrates at startup when its database account has schema permissions. If the application account cannot create or alter tables, a DBA should run:

```text
backend/migration_rbac_mssql.sql
```

for Microsoft SQL Server, or:

```text
backend/migration_rbac_postgres.sql
```

for PostgreSQL.
