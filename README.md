# Fraud Management System

Full-stack fraud case-management application with React/TypeScript frontend, Node/Express API, MSSQL or PostgreSQL support, local or Microsoft Entra ID authentication, case workflow, reports, audit logging, and role-based access control.

## Main modules

- Dashboard
- Fraud Queue and case workflow
- Fraud indicators and supporting documents
- Reports and exports
- System Audit Log
- User Management
- Role and Permission Management

## Run locally

### Frontend

From the project root:

```bash
npm install
npm run dev
```

The frontend normally opens at `http://localhost:5173`.

The root `.env` should contain:

```env
VITE_API_URL=http://localhost:5000
VITE_AUTH_MODE=local
```

Do not add `/api` to `VITE_API_URL`.

### Backend

In a second terminal:

```bash
cd backend
npm install
npm start
```

The API normally runs at `http://localhost:5000`. Verify it using:

```text
http://localhost:5000/api/health
```

The backend automatically ensures the audit and RBAC database structures at startup. For controlled DBA deployment, use the migration file matching the database engine:

- `backend/migration_rbac_mssql.sql`
- `backend/migration_rbac_postgres.sql`

## Local administrator

The configured bootstrap administrator is defined in `backend/.env` through `LOCAL_AUTH_USERS`. In the supplied local configuration it is:

```text
Email: admin@arabianshield.com
Password: Admin@12345!
```

When the database already contains the account with another password, run this once from the `backend` folder:

```bash
npm run reset-local-users
```

Do not enable automatic password resets in production.

## Validation commands

```bash
npm run build
```

```bash
cd backend
node --check server.js
```

See `RBAC_USERS_ROLES_PERMISSIONS.md` for the security model and test scenarios.

## Administrator Password Reset and Intelligent Assistant

This version includes administrator-only local password reset with optional secure temporary-password generation, plus a permission-aware read-only assistant through live case lookup and summarization.

See `ADMIN_RESET_AND_ASSISTANT.md` for permissions, configuration, security controls, audit events, and test scenarios.
