require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function saveUploadedDocumentDb(pool, fraudCaseId, file, category, uploadedBy) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("fraudCaseId", sql.Int, Number(fraudCaseId))
      .input("fileName", sql.NVarChar(255), file.file_name)
      .input("fileType", sql.NVarChar(150), file.file_type || "application/octet-stream")
      .input("fileUrl", sql.NVarChar(sql.MAX), null)
      .input("storagePath", sql.NVarChar(sql.MAX), null)
      .input("fileSize", sql.Int, Number(file.file_size || 0))
      .input("fileData", sql.VarBinary(sql.MAX), file.file_data)
      .input("category", sql.NVarChar(100), category || "supporting_document")
      .input("uploadedBy", sql.NVarChar(150), uploadedBy || "System")
      .query(`
        INSERT INTO dbo.case_documents (
          fraud_case_id,
          file_name,
          file_type,
          file_url,
          storage_path,
          file_size,
          file_data,
          category,
          uploaded_by
        )
        OUTPUT
          INSERTED.id,
          INSERTED.fraud_case_id,
          INSERTED.file_name,
          INSERTED.file_type,
          INSERTED.file_url,
          INSERTED.storage_path,
          INSERTED.file_size,
          INSERTED.category,
          INSERTED.uploaded_by,
          INSERTED.uploaded_at
        VALUES (
          @fraudCaseId,
          @fileName,
          @fileType,
          @fileUrl,
          @storagePath,
          @fileSize,
          @fileData,
          @category,
          @uploadedBy
        )
      `);

    return result.recordset[0];
  }

  const result = await pool.query(
    `
    INSERT INTO case_documents (
      fraud_case_id,
      file_name,
      file_type,
      file_url,
      storage_path,
      file_size,
      file_data,
      category,
      uploaded_by
    )
    VALUES ($1::integer, $2::text, $3::text, $4::text, $5::text, $6::integer, $7::bytea, $8::text, $9::text)
    RETURNING
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
    `,
    [
      fraudCaseId,
      file.file_name,
      file.file_type || "application/octet-stream",
      null,
      null,
      Number(file.file_size || 0),
      file.file_data,
      category || "supporting_document",
      uploadedBy || "System",
    ]
  );

  return result.rows[0];
}

async function saveManualDocumentDb(pool, fraudCaseId, body, uploadedBy) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("fraudCaseId", sql.Int, Number(fraudCaseId))
      .input("fileName", sql.NVarChar(255), body.file_name)
      .input("fileType", sql.NVarChar(150), body.file_type || null)
      .input("fileUrl", sql.NVarChar(sql.MAX), body.file_url || null)
      .input("category", sql.NVarChar(100), body.category || null)
      .input("uploadedBy", sql.NVarChar(150), body.uploaded_by || uploadedBy || "System")
      .query(`
        INSERT INTO dbo.case_documents (
          fraud_case_id,
          file_name,
          file_type,
          file_url,
          category,
          uploaded_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @fraudCaseId,
          @fileName,
          @fileType,
          @fileUrl,
          @category,
          @uploadedBy
        )
      `);

    return result.recordset[0];
  }

  const result = await pool.query(
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
    RETURNING *
    `,
    [
      fraudCaseId,
      body.file_name,
      body.file_type || null,
      body.file_url || null,
      body.category || null,
      body.uploaded_by || uploadedBy || "System",
    ]
  );

  return result.rows[0];
}

async function findDocumentByIdDb(pool, documentId) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("documentId", sql.Int, Number(documentId))
      .query(`
        SELECT TOP 1 *
        FROM dbo.case_documents
        WHERE id = @documentId
      `);

    return result.recordset[0] || null;
  }

  const result = await pool.query(
    `
    SELECT *
    FROM case_documents
    WHERE id = $1::integer
    LIMIT 1
    `,
    [documentId]
  );

  return result.rows[0] || null;
}

module.exports = {
  saveUploadedDocumentDb,
  saveManualDocumentDb,
  findDocumentByIdDb,
};
