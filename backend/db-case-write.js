require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

const CASE_FIELDS = [
  "case_number",
  "claim_id",
  "case_type",
  "case_source",
  "case_source_other",
  "priority_level",
  "case_status",
  "assigned_user",
  "assignment_date",
  "assigned_by",
  "reassignment_reason",
  "case_entry_date",
  "closure_date",
  "closure_reason",
  "insurance_type",
  "suspected_amount",
  "fraud_unit_notes",
  "reporter_name",
  "reporter_email",
  "reporter_mobile",
  "national_id_or_iqama",
  "description",
  "consent_to_terms_and_privacy",
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
  "created_by",
];

function isMssql() {
  return dbType === "mssql";
}

function buildPostgresInsertQuery(tableName, data) {
  const keys = Object.keys(data).filter((key) => CASE_FIELDS.includes(key));
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  const values = keys.map((key) => data[key]);

  return {
    text: `
      INSERT INTO ${tableName} (${keys.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `,
    values,
  };
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

function normalizeMssqlValue(key, value) {
  if (value === undefined || value === "") return null;

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

async function createFraudCaseDb(pool, caseData, documents, createdBy) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const transaction = new sql.Transaction(db);

    await transaction.begin();

    try {
      const keys = Object.keys(caseData).filter((key) => CASE_FIELDS.includes(key));
      const columns = keys.map((key) => `[${key}]`).join(", ");
      const params = keys.map((key) => `@${key}`).join(", ");

      const request = new sql.Request(transaction);

      keys.forEach((key) => {
        request.input(key, getMssqlType(sql, key), normalizeMssqlValue(key, caseData[key]));
      });

      const insertResult = await request.query(`
        INSERT INTO dbo.fraud_cases (${columns})
        OUTPUT INSERTED.*
        VALUES (${params})
      `);

      const fraudCase = insertResult.recordset[0];

      await new sql.Request(transaction)
        .input("fraudCaseId", sql.Int, fraudCase.id)
        .input("responsibleUser", sql.NVarChar(150), createdBy || "System")
        .input("status", sql.NVarChar(100), fraudCase.case_status || "Updated")
        .input("actionType", sql.NVarChar(100), "CASE_CREATED")
        .input("newStatus", sql.NVarChar(100), fraudCase.case_status || null)
        .input("details", sql.NVarChar(sql.MAX), JSON.stringify({ changed_fields: ["case_status"] }))
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
            NULL,
            @newStatus,
            @details
          )
        `);

      if (Array.isArray(documents)) {
        for (const document of documents) {
          if (!document.file_name) continue;

          await new sql.Request(transaction)
            .input("fraudCaseId", sql.Int, fraudCase.id)
            .input("fileName", sql.NVarChar(255), document.file_name)
            .input("fileType", sql.NVarChar(150), document.file_type || null)
            .input("fileUrl", sql.NVarChar(sql.MAX), document.file_url || null)
            .input("category", sql.NVarChar(100), document.category || "supporting_document")
            .input("uploadedBy", sql.NVarChar(150), document.uploaded_by || createdBy || "System")
            .query(`
              INSERT INTO dbo.case_documents (
                fraud_case_id,
                file_name,
                file_type,
                file_url,
                category,
                uploaded_by
              )
              VALUES (
                @fraudCaseId,
                @fileName,
                @fileType,
                @fileUrl,
                @category,
                @uploadedBy
              )
            `);
        }
      }

      await transaction.commit();
      return fraudCase;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertQuery = buildPostgresInsertQuery("fraud_cases", caseData);
    const result = await client.query(insertQuery.text, insertQuery.values);
    const fraudCase = result.rows[0];

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
        createdBy || "System",
        fraudCase.case_status || "Updated",
        "CASE_CREATED",
        null,
        fraudCase.case_status || null,
        JSON.stringify({ changed_fields: ["case_status"] }),
      ]
    );

    if (Array.isArray(documents)) {
      for (const document of documents) {
        if (!document.file_name) continue;

        await client.query(
          `
          INSERT INTO case_documents (
            fraud_case_id,
            file_name,
            file_type,
            file_url,
            category,
            uploaded_by
          )
          VALUES ($1::integer, $2::text, $3::text, $4::text, $5::text, $6::text)
          `,
          [
            fraudCase.id,
            document.file_name,
            document.file_type || null,
            document.file_url || null,
            document.category || "supporting_document",
            document.uploaded_by || createdBy || "System",
          ]
        );
      }
    }

    await client.query("COMMIT");
    return fraudCase;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createFraudCaseDb,
};
