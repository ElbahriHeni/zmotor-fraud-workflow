require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

const UPDATE_FIELDS = [
  "reporter_name",
  "reporter_email",
  "reporter_mobile",
  "national_id_or_iqama",
  "consent_to_terms_and_privacy",
  "claim_id",
  "case_type",
  "case_source",
  "case_source_other",
  "priority_level",
  "case_status",
  "case_entry_date",
  "insurance_type",
  "suspected_amount",
  "description",
  "has_claim",
  "claim_type",
  "claim_status",
  "suspension_date",
  "suspension_reason",
  "fraud_confirmed_date",
  "fraud_detection_method",
  "fraud_amount",
  "action_taken",
  "referred_entity",
  "fraud_indicator_type",
  "indicator_description",
  "occurrence_count",
  "risk_score",
  "risk_level",
  "system_recommendation",
  "fraud_unit_notes",
  "assigned_user",
  "assignment_date",
  "assigned_by",
  "reassignment_reason",
  "closure_date",
  "closure_reason",
];

function isMssql() {
  return dbType === "mssql";
}

function getMssqlType(sql, key) {
  const decimalFields = new Set(["suspected_amount", "fraud_amount"]);
  const intFields = new Set(["occurrence_count", "risk_score"]);
  const bitFields = new Set(["consent_to_terms_and_privacy", "has_claim"]);
  const dateFields = new Set([
    "assignment_date",
    "case_entry_date",
    "closure_date",
    "suspension_date",
    "fraud_confirmed_date",
  ]);

  if (decimalFields.has(key)) return sql.Decimal(18, 2);
  if (intFields.has(key)) return sql.Int;
  if (bitFields.has(key)) return sql.Bit;
  if (dateFields.has(key)) return sql.DateTime2;
  return sql.NVarChar(sql.MAX);
}

function normalizeValue(key, value) {
  if (value === undefined) return undefined;
  if (value === "") return null;

  const intFields = new Set(["occurrence_count", "risk_score"]);
  const decimalFields = new Set(["suspected_amount", "fraud_amount"]);
  const bitFields = new Set(["consent_to_terms_and_privacy", "has_claim"]);
  const dateFields = new Set([
    "assignment_date",
    "case_entry_date",
    "closure_date",
    "suspension_date",
    "fraud_confirmed_date",
  ]);

  if (value === null) return null;
  if (bitFields.has(key)) return value ? 1 : 0;
  if (intFields.has(key)) return Number(value || 0);
  if (decimalFields.has(key)) return Number(value || 0);
  if (dateFields.has(key)) return value ? new Date(value) : null;

  return String(value);
}

function buildCaseUpdateData(body, existingCase) {
  const updateData = {};

  for (const key of UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      updateData[key] = body[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(updateData, "case_status")) {
    const requestedStatus =
      updateData.case_status === "مفتوح"
        ? "Open"
        : updateData.case_status === "معلق"
          ? "Suspended"
          : updateData.case_status === "مغلق"
            ? "Closed"
            : updateData.case_status;
    updateData.case_status = requestedStatus;

    if (requestedStatus === "Closed") {
      updateData.closure_date = updateData.closure_date || existingCase?.closure_date || new Date();
    }

    if (requestedStatus === "Open" || requestedStatus === "Suspended") {
      updateData.closure_date = null;
      updateData.closure_reason = null;
    }
  }

  return updateData;
}

async function updateFraudCaseDb(pool, fraudCase, body, updatedBy) {
  const rawUpdateData = buildCaseUpdateData(body || {}, fraudCase || {});
  const updateData = {};

  for (const [key, value] of Object.entries(rawUpdateData)) {
    if (UPDATE_FIELDS.includes(key) && value !== undefined) {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return fraudCase;
  }

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const transaction = new sql.Transaction(db);

    await transaction.begin();

    try {
      const keys = Object.keys(updateData);
      const setClause = keys.map((key) => `[${key}] = @${key}`).join(", ");

      const request = new sql.Request(transaction);
      request.input("id", sql.Int, Number(fraudCase.id));

      keys.forEach((key) => {
        request.input(key, getMssqlType(sql, key), normalizeValue(key, updateData[key]));
      });

      const result = await request.query(`
        UPDATE dbo.fraud_cases
        SET ${setClause},
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

      const updatedCase = result.recordset[0];

      const changedFields = keys.filter((key) => String(fraudCase[key] ?? "") !== String(updatedCase[key] ?? ""));
      const statusChanged = String(fraudCase.case_status || "") !== String(updatedCase.case_status || "");
      const actionType = statusChanged ? "CASE_STATUS_CHANGED" : "CASE_UPDATED";
      const actionDetails = JSON.stringify({ changed_fields: changedFields });

      await new sql.Request(transaction)
        .input("fraudCaseId", sql.Int, Number(fraudCase.id))
        .input("responsibleUser", sql.NVarChar(150), updatedBy || "System")
        .input("status", sql.NVarChar(100), updatedCase.case_status || "Updated")
        .input("actionType", sql.NVarChar(100), actionType)
        .input("previousStatus", sql.NVarChar(100), statusChanged ? fraudCase.case_status || null : null)
        .input("newStatus", sql.NVarChar(100), statusChanged ? updatedCase.case_status || null : null)
        .input("details", sql.NVarChar(sql.MAX), actionDetails)
        .query(`
          INSERT INTO dbo.case_action_logs (
            fraud_case_id,
            responsible_user,
            status,
            action_type,
            previous_status,
            new_status,
            details
          )
          VALUES (
            @fraudCaseId,
            @responsibleUser,
            @status,
            @actionType,
            @previousStatus,
            @newStatus,
            @details
          )
        `);

      await transaction.commit();
      return updatedCase;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const keys = Object.keys(updateData);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(", ");
    const values = [fraudCase.id, ...keys.map((key) => normalizeValue(key, updateData[key]))];

    const result = await client.query(
      `
      UPDATE fraud_cases
      SET ${setClause},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::integer
      RETURNING *
      `,
      values
    );

    const updatedCase = result.rows[0];

    const changedFields = keys.filter((key) => String(fraudCase[key] ?? "") !== String(updatedCase[key] ?? ""));
    const statusChanged = String(fraudCase.case_status || "") !== String(updatedCase.case_status || "");

    await client.query(
      `
      INSERT INTO case_action_logs (
        fraud_case_id,
        responsible_user,
        status,
        action_type,
        previous_status,
        new_status,
        details
      )
      VALUES ($1::integer, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text)
      `,
      [
        fraudCase.id,
        updatedBy || "System",
        updatedCase.case_status || "Updated",
        statusChanged ? "CASE_STATUS_CHANGED" : "CASE_UPDATED",
        statusChanged ? fraudCase.case_status || null : null,
        statusChanged ? updatedCase.case_status || null : null,
        JSON.stringify({ changed_fields: changedFields }),
      ]
    );

    await client.query("COMMIT");
    return updatedCase;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  updateFraudCaseDb,
};
