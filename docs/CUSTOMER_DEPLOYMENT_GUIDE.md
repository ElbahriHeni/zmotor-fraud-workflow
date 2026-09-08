# Fraud Management Application - Customer Deployment Guide

## 1. Application Components

The application has two components:

1. Frontend
   - React / Vite web application.
   - Can be deployed using Nginx container, Vercel, or IIS static hosting.

2. Backend
   - Node.js / Express API.
   - Connects to Microsoft SQL Server.
   - Handles authentication, fraud cases, reports, and document storage.

## 2. Database

Target production database:

- Microsoft SQL Server
- Database name: FraudManagementDB
- Main tables:
  - dbo.fraud_cases
  - dbo.case_documents
  - dbo.case_action_logs
  - dbo.app_users

Documents are stored inside SQL Server using:

- dbo.case_documents.file_data VARBINARY(MAX)

## 3. Required Environment Variables

Backend requires:

- DB_TYPE=mssql
- MSSQL_HOST
- MSSQL_PORT
- MSSQL_DATABASE
- MSSQL_USER
- MSSQL_PASSWORD
- MSSQL_ENCRYPT
- MSSQL_TRUST_SERVER_CERTIFICATE
- AUTH_MODE
- JWT_SECRET
- FRONTEND_URL

For current handover/demo, authentication mode is:

- AUTH_MODE=local

For customer production AD/Entra integration, switch later to:

- AUTH_MODE=ad

and configure:

- AD_TENANT_ID
- AD_CLIENT_ID
- AD_AUDIENCE
- AD_ALLOWED_GROUP_ID

## 4. Docker Deployment

### Build and run

From the project root:

```bash
docker compose up --build -d
```

Frontend:

```text
http://localhost:8080
```

Backend:

```text
http://localhost:5000/api/health
```

### Health Check

Open:

```text
http://localhost:5000/api/health
```

Expected:

```json
{
  "status": "ok",
  "backend": "running",
  "database": "connected",
  "databaseType": "mssql"
}
```

## 5. IIS / Windows Deployment Option

Recommended Windows setup:

1. Build frontend:
   ```bash
   npm install
   npm run build
   ```

2. Host frontend `dist` folder in IIS as a static website.

3. Run backend using Node.js as a Windows service through a service manager such as NSSM or PM2.

4. Configure IIS reverse proxy if the customer wants one public URL:
   - `/` routes to frontend static files.
   - `/api` routes to backend Node service.

5. Backend should run with production `.env` values.

## 6. Functional Smoke Test

After deployment, test:

1. Login.
2. Dashboard loads.
3. Fraud Queue loads.
4. Create Draft.
5. Open Draft.
6. Save Changes.
7. Submit/Open case.
8. Upload attachment.
9. Download attachment.
10. Close case.
11. Reopen case.
12. Reports load.
13. Excel export works.

## 7. Security Notes

Before production:

1. Replace all demo passwords.
2. Generate strong JWT_SECRET.
3. Use customer-managed SQL Server credentials.
4. Remove local bootstrap users if AD authentication is enabled.
5. Enable HTTPS.
6. Restrict CORS to customer production frontend URL.
7. Confirm upload file size and extension policy.
8. Run code review and penetration testing.
9. Rotate any secrets that were shared during development.
10. Do not commit `.env` files to Git.

## 8. Delivery Checklist

Deliver to customer IT:

- Source code repository or source package.
- Docker image or Docker build files.
- SQL Server schema/migration scripts.
- Environment variable template.
- Deployment guide.
- Functional test checklist.
- Security checklist.
