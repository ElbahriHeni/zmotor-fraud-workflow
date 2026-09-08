require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function getCaseDocumentsDb(pool, fraudCaseId) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("fraudCaseId", sql.Int, Number(fraudCaseId))
      .query(`
        SELECT
          id,
          fraud_case_id,
          file_name,
          file_type,
          file_url,
          storage_path,
          file_size,
          category,
          uploaded_by,
          uploaded_at
        FROM dbo.case_documents
        WHERE fraud_case_id = @fraudCaseId
        ORDER BY uploaded_at DESC
      `);

    return result.recordset;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM case_documents
    WHERE fraud_case_id = $1::integer
    ORDER BY uploaded_at DESC
    `,
    [fraudCaseId]
  );

  return result.rows;
}

async function getCaseActionLogsDb(pool, fraudCaseId) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("fraudCaseId", sql.Int, Number(fraudCaseId))
      .query(`
        SELECT
          id,
          fraud_case_id,
          responsible_user,
          status,
          action_type,
          previous_status,
          new_status,
          details,
          action_time
        FROM dbo.case_action_logs
        WHERE fraud_case_id = @fraudCaseId
        ORDER BY action_time DESC
      `);

    return result.recordset;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM case_action_logs
    WHERE fraud_case_id = $1::integer
    ORDER BY action_time DESC
    `,
    [fraudCaseId]
  );

  return result.rows;
}

async function getCaseAssignmentHistoryDb(pool, fraudCaseId) {
  if (isMssql()) {
    // Current MSSQL schema does not include case_assignment_history.
    // Return an empty list so the Case Details page can open without failing.
    return [];
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM case_assignment_history
      WHERE fraud_case_id = $1::integer
      ORDER BY change_date DESC
      `,
      [fraudCaseId]
    );

    return result.rows;
  } catch (error) {
    // If the table does not exist in the current PostgreSQL demo DB, do not block Case Details.
    if (error.code === "42P01") {
      return [];
    }

    throw error;
  }
}

module.exports = {
  getCaseDocumentsDb,
  getCaseActionLogsDb,
  getCaseAssignmentHistoryDb,
};
