require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function getAssignedCasesDb(pool, user, status) {
  const email = String(user?.email || "").trim().toLowerCase();
  const name = String(user?.name || "").trim().toLowerCase();
  const username = String(user?.username || "").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim();

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("email", sql.NVarChar(255), email)
      .input("name", sql.NVarChar(255), name)
      .input("username", sql.NVarChar(100), username)
      .input("status", sql.NVarChar(50), normalizedStatus || null)
      .query(`
        SELECT TOP 20
          id, case_number, case_status, case_type, priority_level,
          case_entry_date, assigned_user, insurance_type, updated_at
        FROM dbo.fraud_cases
        WHERE (
          LOWER(LTRIM(RTRIM(ISNULL(assigned_user, N'')))) IN (@email, @name, @username)
          OR LOWER(LTRIM(RTRIM(ISNULL(assigned_user, N'')))) LIKE N'%' + @email + N'%'
        )
          AND (@status IS NULL OR case_status = @status)
          AND ISNULL(case_status, N'') <> N'Draft'
        ORDER BY updated_at DESC, created_at DESC
      `);
    return result.recordset;
  }

  const result = await pool.query(
    `
    SELECT
      id, case_number, case_status, case_type, priority_level,
      case_entry_date, assigned_user, insurance_type, updated_at
    FROM fraud_cases
    WHERE (
      lower(btrim(COALESCE(assigned_user, ''))) IN (lower($1::text), lower($2::text), lower($3::text))
      OR lower(btrim(COALESCE(assigned_user, ''))) LIKE '%' || lower($1::text) || '%'
    )
      AND ($4::text = '' OR case_status = $4::text)
      AND COALESCE(case_status, '') <> 'Draft'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 20
    `,
    [email, name, username, normalizedStatus]
  );
  return result.rows;
}

module.exports = {
  getAssignedCasesDb,
};
