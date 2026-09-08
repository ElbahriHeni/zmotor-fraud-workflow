require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function getDatabaseHealth(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT SYSUTCDATETIME() AS now
    `);

    return {
      database: "connected",
      type: "mssql",
      time: result.recordset[0]?.now,
    };
  }

  const result = await pool.query("SELECT NOW() AS now");

  return {
    database: "connected",
    type: "postgres",
    time: result.rows[0]?.now,
  };
}

async function getDashboardSummaryDb(pool, currentUserEmail) {
  const email = String(currentUserEmail || "").trim().toLowerCase();

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("email", sql.NVarChar(255), email)
      .query(`
        SELECT
          COUNT(1) AS total_cases,
          SUM(CASE WHEN case_status = N'Draft' THEN 1 ELSE 0 END) AS my_draft_cases,
          SUM(CASE WHEN case_status = N'Open' THEN 1 ELSE 0 END) AS open_cases,
          SUM(CASE WHEN case_status = N'Closed' THEN 1 ELSE 0 END) AS closed_cases,
          SUM(CASE WHEN case_type IN (N'Fraud Confirmed', N'احتيال مؤكد') THEN 1 ELSE 0 END) AS confirmed_fraud_cases,
          SUM(CASE WHEN case_status IN (N'Suspended', N'معلق') THEN 1 ELSE 0 END) AS suspended_claims,
          SUM(CASE WHEN priority_level = N'High' THEN 1 ELSE 0 END) AS high_priority_cases,
          COALESCE(SUM(COALESCE(fraud_amount, 0)), 0) AS fraud_amount
        FROM dbo.fraud_cases
        WHERE ISNULL(case_status, N'') <> N'Draft'
           OR LOWER(ISNULL(created_by, N'')) = LOWER(@email)
      `);

    const row = result.recordset[0] || {};

    return {
      total_cases: Number(row.total_cases || 0),
      my_draft_cases: Number(row.my_draft_cases || 0),
      open_cases: Number(row.open_cases || 0),
      closed_cases: Number(row.closed_cases || 0),
      confirmed_fraud_cases: Number(row.confirmed_fraud_cases || 0),
      suspended_claims: Number(row.suspended_claims || 0),
      high_priority_cases: Number(row.high_priority_cases || 0),
      fraud_amount: Number(row.fraud_amount || 0),
    };
  }

  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_cases,
      COUNT(*) FILTER (WHERE case_status = 'Draft')::int AS my_draft_cases,
      COUNT(*) FILTER (WHERE case_status = 'Open')::int AS open_cases,
      COUNT(*) FILTER (WHERE case_status = 'Closed')::int AS closed_cases,
      COUNT(*) FILTER (WHERE case_type IN ('Fraud Confirmed', 'احتيال مؤكد'))::int AS confirmed_fraud_cases,
      COUNT(*) FILTER (WHERE case_status IN ('Suspended', 'معلق'))::int AS suspended_claims,
      COUNT(*) FILTER (WHERE priority_level = 'High')::int AS high_priority_cases,
      COALESCE(SUM(fraud_amount), 0)::numeric AS fraud_amount
    FROM fraud_cases
    WHERE case_status <> 'Draft'
       OR LOWER(COALESCE(created_by, '')) = LOWER($1::text)
    `,
    [email]
  );

  const row = result.rows[0] || {};

  return {
    total_cases: Number(row.total_cases || 0),
    my_draft_cases: Number(row.my_draft_cases || 0),
    open_cases: Number(row.open_cases || 0),
    closed_cases: Number(row.closed_cases || 0),
    confirmed_fraud_cases: Number(row.confirmed_fraud_cases || 0),
    suspended_claims: Number(row.suspended_claims || 0),
    high_priority_cases: Number(row.high_priority_cases || 0),
    fraud_amount: Number(row.fraud_amount || 0),
  };
}

async function getCaseQueueDb(pool, currentUserEmail) {
  const email = String(currentUserEmail || "").trim().toLowerCase();

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("email", sql.NVarChar(255), email)
      .query(`
        SELECT
          id,
          case_number,
          reporter_name,
          reporter_email,
          reporter_mobile,
          national_id_or_iqama,
          consent_to_terms_and_privacy,
          claim_id,
          case_type,
          case_source,
          case_source_other,
          priority_level,
          case_status,
          case_entry_date,
          insurance_type,
          suspected_amount,
          description,
          has_claim,
          claim_type,
          claim_status,
          suspension_date,
          suspension_reason,
          fraud_confirmed_date,
          fraud_detection_method,
          fraud_amount,
          action_taken,
          referred_entity,
          fraud_indicator_type,
          indicator_description,
          occurrence_count,
          risk_level,
          system_recommendation,
          assigned_user,
          assigned_by,
          assignment_date,
          closure_date,
          closure_reason,
          fraud_unit_notes,
          created_by,
          created_at,
          updated_at
        FROM dbo.fraud_cases
        WHERE ISNULL(case_status, N'') <> N'Draft'
           OR LOWER(ISNULL(created_by, N'')) = LOWER(@email)
        ORDER BY created_at DESC
      `);

    return result.recordset;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM fraud_cases
    WHERE case_status <> 'Draft'
       OR LOWER(COALESCE(created_by, '')) = LOWER($1::text)
    ORDER BY created_at DESC
    `,
    [email]
  );

  return result.rows;
}

module.exports = {
  getDatabaseHealth,
  getDashboardSummaryDb,
  getCaseQueueDb,
};
