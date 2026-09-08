require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ message: "Unable to serialize audit details." });
  }
}

async function ensureAuditSchemaDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();

    await db.request().query(`
      IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.audit_logs (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          actor_user_id NVARCHAR(100) NULL,
          actor_email NVARCHAR(255) NULL,
          actor_name NVARCHAR(255) NULL,
          actor_role NVARCHAR(100) NULL,
          action_code NVARCHAR(120) NOT NULL,
          entity_type NVARCHAR(100) NULL,
          entity_id NVARCHAR(200) NULL,
          http_method NVARCHAR(10) NULL,
          route NVARCHAR(500) NULL,
          success BIT NOT NULL CONSTRAINT DF_audit_logs_success DEFAULT (1),
          status_code INT NULL,
          details NVARCHAR(MAX) NULL,
          ip_address NVARCHAR(100) NULL,
          user_agent NVARCHAR(1000) NULL,
          created_at DATETIME2 NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSUTCDATETIME()
        );

        CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs(created_at DESC);
        CREATE INDEX IX_audit_logs_actor_email ON dbo.audit_logs(actor_email);
        CREATE INDEX IX_audit_logs_action_code ON dbo.audit_logs(action_code);
      END;

      IF OBJECT_ID(N'dbo.case_action_logs', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.case_action_logs', 'action_type') IS NULL
          ALTER TABLE dbo.case_action_logs ADD action_type NVARCHAR(100) NULL;
        IF COL_LENGTH('dbo.case_action_logs', 'previous_status') IS NULL
          ALTER TABLE dbo.case_action_logs ADD previous_status NVARCHAR(100) NULL;
        IF COL_LENGTH('dbo.case_action_logs', 'new_status') IS NULL
          ALTER TABLE dbo.case_action_logs ADD new_status NVARCHAR(100) NULL;
        IF COL_LENGTH('dbo.case_action_logs', 'details') IS NULL
          ALTER TABLE dbo.case_action_logs ADD details NVARCHAR(MAX) NULL;
      END;
    `);

    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id VARCHAR(100),
      actor_email VARCHAR(255),
      actor_name VARCHAR(255),
      actor_role VARCHAR(100),
      action_code VARCHAR(120) NOT NULL,
      entity_type VARCHAR(100),
      entity_id VARCHAR(200),
      http_method VARCHAR(10),
      route VARCHAR(500),
      success BOOLEAN NOT NULL DEFAULT true,
      status_code INTEGER,
      details TEXT,
      ip_address VARCHAR(100),
      user_agent VARCHAR(1000),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_email ON audit_logs(actor_email);
    CREATE INDEX IF NOT EXISTS ix_audit_logs_action_code ON audit_logs(action_code);

    ALTER TABLE case_action_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(100);
    ALTER TABLE case_action_logs ADD COLUMN IF NOT EXISTS previous_status VARCHAR(100);
    ALTER TABLE case_action_logs ADD COLUMN IF NOT EXISTS new_status VARCHAR(100);
    ALTER TABLE case_action_logs ADD COLUMN IF NOT EXISTS details TEXT;
  `);
}

async function writeAuditLogDb(pool, record) {
  const details = typeof record.details === "string" ? record.details : safeJson(record.details);

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    await db
      .request()
      .input("actorUserId", sql.NVarChar(100), record.actorUserId ? String(record.actorUserId) : null)
      .input("actorEmail", sql.NVarChar(255), record.actorEmail || null)
      .input("actorName", sql.NVarChar(255), record.actorName || null)
      .input("actorRole", sql.NVarChar(100), record.actorRole || null)
      .input("actionCode", sql.NVarChar(120), record.actionCode || "UNKNOWN_ACTION")
      .input("entityType", sql.NVarChar(100), record.entityType || null)
      .input("entityId", sql.NVarChar(200), record.entityId ? String(record.entityId) : null)
      .input("httpMethod", sql.NVarChar(10), record.httpMethod || null)
      .input("route", sql.NVarChar(500), record.route || null)
      .input("success", sql.Bit, record.success === false ? 0 : 1)
      .input("statusCode", sql.Int, Number(record.statusCode || 0) || null)
      .input("details", sql.NVarChar(sql.MAX), details)
      .input("ipAddress", sql.NVarChar(100), record.ipAddress || null)
      .input("userAgent", sql.NVarChar(1000), record.userAgent || null)
      .query(`
        INSERT INTO dbo.audit_logs (
          actor_user_id,
          actor_email,
          actor_name,
          actor_role,
          action_code,
          entity_type,
          entity_id,
          http_method,
          route,
          success,
          status_code,
          details,
          ip_address,
          user_agent
        )
        VALUES (
          @actorUserId,
          @actorEmail,
          @actorName,
          @actorRole,
          @actionCode,
          @entityType,
          @entityId,
          @httpMethod,
          @route,
          @success,
          @statusCode,
          @details,
          @ipAddress,
          @userAgent
        )
      `);

    return;
  }

  await pool.query(
    `
    INSERT INTO audit_logs (
      actor_user_id,
      actor_email,
      actor_name,
      actor_role,
      action_code,
      entity_type,
      entity_id,
      http_method,
      route,
      success,
      status_code,
      details,
      ip_address,
      user_agent
    )
    VALUES (
      $1::text,
      $2::text,
      $3::text,
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::text,
      $10::boolean,
      $11::integer,
      $12::text,
      $13::text,
      $14::text
    )
    `,
    [
      record.actorUserId ? String(record.actorUserId) : null,
      record.actorEmail || null,
      record.actorName || null,
      record.actorRole || null,
      record.actionCode || "UNKNOWN_ACTION",
      record.entityType || null,
      record.entityId ? String(record.entityId) : null,
      record.httpMethod || null,
      record.route || null,
      record.success !== false,
      Number(record.statusCode || 0) || null,
      details,
      record.ipAddress || null,
      record.userAgent || null,
    ]
  );
}

async function getAuditLogsDb(pool, filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 200), 1), 1000);
  const action = String(filters.action || "").trim();
  const actor = String(filters.actor || "").trim();
  const entityType = String(filters.entityType || "").trim();

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("limit", sql.Int, limit)
      .input("action", sql.NVarChar(120), action || null)
      .input("actor", sql.NVarChar(255), actor || null)
      .input("entityType", sql.NVarChar(100), entityType || null)
      .query(`
        SELECT TOP (@limit)
          id,
          actor_user_id,
          actor_email,
          actor_name,
          actor_role,
          action_code,
          entity_type,
          entity_id,
          http_method,
          route,
          success,
          status_code,
          details,
          ip_address,
          user_agent,
          created_at
        FROM dbo.audit_logs
        WHERE (@action IS NULL OR action_code = @action)
          AND (@actor IS NULL OR actor_email LIKE '%' + @actor + '%' OR actor_name LIKE '%' + @actor + '%')
          AND (@entityType IS NULL OR entity_type = @entityType)
        ORDER BY created_at DESC
      `);

    return result.recordset;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      actor_user_id,
      actor_email,
      actor_name,
      actor_role,
      action_code,
      entity_type,
      entity_id,
      http_method,
      route,
      success,
      status_code,
      details,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    WHERE ($1::text = '' OR action_code = $1::text)
      AND ($2::text = '' OR actor_email ILIKE '%' || $2::text || '%' OR actor_name ILIKE '%' || $2::text || '%')
      AND ($3::text = '' OR entity_type = $3::text)
    ORDER BY created_at DESC
    LIMIT $4::integer
    `,
    [action, actor, entityType, limit]
  );

  return result.rows;
}

module.exports = {
  ensureAuditSchemaDb,
  writeAuditLogDb,
  getAuditLogsDb,
};
