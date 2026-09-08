require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function getFraudCasesReportDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT
        case_number AS case_id,
        claim_id,
        case_entry_date,
        case_source,
        case_type,
        priority_level,
        case_status,
        fraud_unit_notes,
        closure_date,
        closure_reason,
        suspected_amount,
        insurance_type
      FROM dbo.fraud_cases
      WHERE ISNULL(case_status, N'') NOT IN (N'Draft', N'مسودة')
      ORDER BY
        CASE WHEN case_entry_date IS NULL THEN 1 ELSE 0 END,
        case_entry_date DESC,
        created_at DESC
    `);

    return result.recordset;
  }

  const result = await pool.query(`
    SELECT
      case_number AS case_id,
      claim_id,
      case_entry_date,
      case_source,
      case_type,
      priority_level,
      case_status,
      fraud_unit_notes,
      closure_date,
      closure_reason,
      suspected_amount,
      insurance_type
    FROM fraud_cases
    WHERE COALESCE(case_status, '') NOT IN ('Draft', 'مسودة')
    ORDER BY case_entry_date DESC NULLS LAST, created_at DESC
  `);

  return result.rows;
}

async function getConfirmedFraudReportDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT
        case_number AS case_id,
        claim_id,
        claim_type,
        insurance_type,
        fraud_confirmed_date,
        fraud_detection_method,
        fraud_amount,
        action_taken,
        referred_entity,
        case_entry_date,
        case_source,
        case_type,
        priority_level,
        case_status
      FROM dbo.fraud_cases
      WHERE ISNULL(case_status, N'') NOT IN (N'Draft', N'مسودة')
        AND case_type IN (N'Fraud Confirmed', N'احتيال مؤكد')
      ORDER BY
        CASE WHEN fraud_confirmed_date IS NULL THEN 1 ELSE 0 END,
        fraud_confirmed_date DESC,
        CASE WHEN case_entry_date IS NULL THEN 1 ELSE 0 END,
        case_entry_date DESC,
        created_at DESC
    `);

    return result.recordset;
  }

  const result = await pool.query(`
    SELECT
      case_number AS case_id,
      claim_id,
      claim_type,
      insurance_type,
      fraud_confirmed_date,
      fraud_detection_method,
      fraud_amount,
      action_taken,
      referred_entity,
      case_entry_date,
      case_source,
      case_type,
      priority_level,
      case_status
    FROM fraud_cases
    WHERE COALESCE(case_status, '') NOT IN ('Draft', 'مسودة')
      AND case_type IN ('Fraud Confirmed', 'احتيال مؤكد')
    ORDER BY fraud_confirmed_date DESC NULLS LAST, case_entry_date DESC NULLS LAST, created_at DESC
  `);

  return result.rows;
}

async function getFraudIndicatorsReportDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT
        case_number AS case_id,
        claim_id,
        fraud_indicator_type,
        indicator_description,
        occurrence_count,
        risk_level,
        system_recommendation,
        case_entry_date,
        case_source,
        case_type,
        priority_level,
        case_status,
        insurance_type
      FROM dbo.fraud_cases
      WHERE ISNULL(case_status, N'') NOT IN (N'Draft', N'مسودة')
        AND case_type IN (N'Fraud Confirmed', N'Fraud Suspected', N'احتيال مؤكد', N'اشتباه الاحتيال')
      ORDER BY
        CASE WHEN case_entry_date IS NULL THEN 1 ELSE 0 END,
        case_entry_date DESC,
        created_at DESC
    `);

    return result.recordset;
  }

  const result = await pool.query(`
    SELECT
      case_number AS case_id,
      claim_id,
      fraud_indicator_type,
      indicator_description,
      occurrence_count,
      risk_level,
      system_recommendation,
      case_entry_date,
      case_source,
      case_type,
      priority_level,
      case_status,
      insurance_type
    FROM fraud_cases
    WHERE COALESCE(case_status, '') NOT IN ('Draft', 'مسودة')
      AND case_type IN ('Fraud Confirmed', 'Fraud Suspected', 'احتيال مؤكد', 'اشتباه الاحتيال')
    ORDER BY case_entry_date DESC NULLS LAST, created_at DESC
  `);

  return result.rows;
}

async function getSuspendedFraudReportDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT
        case_number AS case_id,
        claim_id,
        suspension_date,
        suspension_reason,
        priority_level,
        case_status,
        assigned_user,
        case_entry_date,
        case_source,
        case_type,
        insurance_type
      FROM dbo.fraud_cases
      WHERE case_status IN (N'Suspended', N'معلق')
      ORDER BY
        CASE WHEN suspension_date IS NULL THEN 1 ELSE 0 END,
        suspension_date DESC,
        CASE WHEN case_entry_date IS NULL THEN 1 ELSE 0 END,
        case_entry_date DESC,
        created_at DESC
    `);

    return result.recordset;
  }

  const result = await pool.query(`
    SELECT
      case_number AS case_id,
      claim_id,
      suspension_date,
      suspension_reason,
      priority_level,
      case_status,
      assigned_user,
      case_entry_date,
      case_source,
      case_type,
      insurance_type
    FROM fraud_cases
    WHERE case_status IN ('Suspended', 'معلق')
    ORDER BY suspension_date DESC NULLS LAST, case_entry_date DESC NULLS LAST, created_at DESC
  `);

  return result.rows;
}

async function getFraudPerformanceReportDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db.request().query(`
      SELECT
        fc.case_number AS case_id,
        fc.claim_id,
        fc.case_entry_date,
        fc.case_source,
        fc.case_type,
        fc.priority_level,
        fc.case_status,
        fc.insurance_type,
        fc.fraud_amount,
        fc.closure_date,
        (
          SELECT MIN(cal.action_time)
          FROM dbo.case_action_logs cal
          WHERE cal.fraud_case_id = fc.id
            AND cal.status IN (N'Open', N'مفتوح')
        ) AS open_time,
        (
          SELECT MIN(cal.action_time)
          FROM dbo.case_action_logs cal
          WHERE cal.fraud_case_id = fc.id
            AND cal.status IN (N'Closed', N'مغلق')
        ) AS close_time
      FROM dbo.fraud_cases fc
      WHERE ISNULL(fc.case_status, N'') NOT IN (N'Draft', N'مسودة')
      ORDER BY
        CASE WHEN fc.case_entry_date IS NULL THEN 1 ELSE 0 END,
        fc.case_entry_date DESC,
        fc.created_at DESC
    `);

    return result.recordset;
  }

  const result = await pool.query(`
    SELECT
      fc.case_number AS case_id,
      fc.claim_id,
      fc.case_entry_date,
      fc.case_source,
      fc.case_type,
      fc.priority_level,
      fc.case_status,
      fc.insurance_type,
      fc.fraud_amount,
      fc.closure_date,
      (
        SELECT MIN(cal.action_time)
        FROM case_action_logs cal
        WHERE cal.fraud_case_id = fc.id
          AND cal.status IN ('Open', 'مفتوح')
      ) AS open_time,
      (
        SELECT MIN(cal.action_time)
        FROM case_action_logs cal
        WHERE cal.fraud_case_id = fc.id
          AND cal.status IN ('Closed', 'مغلق')
      ) AS close_time
    FROM fraud_cases fc
    WHERE COALESCE(fc.case_status, '') NOT IN ('Draft', 'مسودة')
    ORDER BY fc.case_entry_date DESC NULLS LAST, fc.created_at DESC
  `);

  return result.rows;
}

module.exports = {
  getFraudCasesReportDb,
  getConfirmedFraudReportDb,
  getFraudIndicatorsReportDb,
  getSuspendedFraudReportDb,
  getFraudPerformanceReportDb,
};
