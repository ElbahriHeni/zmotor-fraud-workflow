# MSSQL Step 1 Files

This step prepares the project for Microsoft SQL Server without switching the application yet.

## Files

- `database/001_create_tables_mssql.sql`
  - SQL Server schema equivalent to the current PostgreSQL schema.
  - Documents are stored as `VARBINARY(MAX)`.

- `backend/db-postgres.js`
  - Existing PostgreSQL connection moved to a dedicated file.

- `backend/db-mssql.js`
  - New SQL Server connection helper using the `mssql` package.

- `backend/db.js`
  - Keeps the app on PostgreSQL for now.
  - Blocks accidental `DB_TYPE=mssql` until backend routes are converted.

- `backend_env_mssql_prepare.txt`
  - Environment variables to add later.

## Important

Do not set `DB_TYPE=mssql` yet.
The SQL Server schema and connection helper are ready, but `server.js` still uses PostgreSQL SQL syntax.
The next step is to convert the backend routes gradually.
