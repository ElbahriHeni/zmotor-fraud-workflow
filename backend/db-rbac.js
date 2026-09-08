const bcrypt = require("bcryptjs");
require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

const PERMISSIONS = [
  ["dashboard.view", "View Dashboard", "Dashboard", "Open the operational dashboard."],
  ["cases.view", "View Cases", "Cases", "View fraud cases and case history."],
  ["cases.create", "Create Cases", "Cases", "Create and save fraud cases."],
  ["cases.update", "Update Cases", "Cases", "Edit fraud case information."],
  ["cases.change_status", "Change Case Status", "Cases", "Open, suspend, or close fraud cases."],
  ["cases.assign", "Assign Cases", "Cases", "Assign, reassign, or release cases."],
  ["cases.upload_documents", "Upload Documents", "Cases", "Upload or register case documents."],
  ["cases.download_documents", "Download Documents", "Cases", "View and download case documents."],
  ["cases.export_pdf", "Export Case PDF", "Cases", "Export a fraud case as PDF."],
  ["reports.view", "View Reports", "Reports", "Open fraud reports."],
  ["reports.export", "Export Reports", "Reports", "Export filtered report results."],
  ["fraud_assessment.view", "View Fraud Assessment", "Fraud Assessment", "Open and review fraud assessment responses."],
  ["fraud_assessment.edit", "Edit Fraud Assessment", "Fraud Assessment", "Create and update fraud assessment responses."],
  ["fraud_assessment.submit", "Submit Fraud Assessment", "Fraud Assessment", "Submit the fraud assessment."],
  ["motor_fraud.view", "View Motor Fraud", "Motor Fraud", "View authorized Motor Fraud workflow cases."],
  ["motor_fraud.create", "Create Motor Fraud", "Motor Fraud", "Initiate a Motor Fraud workflow case."],
  ["motor_fraud.edit", "Edit Motor Fraud Data", "Motor Fraud", "Edit Motor team data while the case is with Motor."],
  ["motor_fraud.submit", "Submit Motor Fraud", "Motor Fraud", "Submit or resubmit Motor Fraud cases to the requesting review team."],
  ["motor_fraud.upload_documents", "Upload Motor Fraud Documents", "Motor Fraud", "Upload supporting Motor Fraud documents."],
  ["motor_fraud.download_documents", "Download Motor Fraud Documents", "Motor Fraud", "Download supporting Motor Fraud documents."],
  ["motor_fraud.legal_review", "Legal Review Motor Fraud", "Motor Fraud", "Approve or return Motor Fraud cases from Legal."],
  ["motor_fraud.fraud_review", "Fraud Review Motor Fraud", "Motor Fraud", "Close, reject, or return Motor Fraud cases from Fraud."],
  ["motor_fraud.close_returned", "Close Returned Motor Fraud", "Motor Fraud", "Allow Motor to close a case returned by Legal or Fraud."],
  ["motor_fraud.export", "Export Motor Fraud", "Motor Fraud", "Export authorized Motor Fraud cases."],
  ["users.view", "View Users", "User Management", "View application users."],
  ["users.create", "Create Users", "User Management", "Create application users."],
  ["users.update", "Update Users", "User Management", "Edit application users and roles."],
  ["users.activate", "Activate or Deactivate Users", "User Management", "Control whether users can sign in."],
  ["users.reset_password", "Reset Passwords", "User Management", "Reset local user passwords."],
  ["users.manage_permissions", "Manage User Permissions", "User Management", "Grant or deny user-level permission overrides."],
  ["roles.view", "View Roles", "Role Management", "View roles and their permissions."],
  ["roles.create", "Create Roles", "Role Management", "Create configurable application roles."],
  ["roles.update", "Update Roles", "Role Management", "Edit role details and activation status."],
  ["roles.manage_permissions", "Manage Role Permissions", "Role Management", "Configure permissions assigned to roles."],
  ["audit.view", "View Audit Log", "Audit & Compliance", "Review security and business activity."],
  ["assistant.use", "Use Intelligent Assistant", "Intelligent Assistant", "Open the read-only in-application assistant."],
  ["assistant.view_case_status", "Assistant Case Status Lookup", "Intelligent Assistant", "Ask the assistant for the current status of authorized cases."],
  ["assistant.summarize_cases", "Assistant Case Summaries", "Intelligent Assistant", "Ask the assistant to summarize authorized cases without personal reporter data."],
  ["assistant.view_assigned_cases", "Assistant Assigned Cases", "Intelligent Assistant", "Ask the assistant to list cases assigned to the signed-in user."],
  ["assistant.view_operational_statistics", "Assistant Operational Statistics", "Intelligent Assistant", "Ask the assistant for authorized case status counts."],
];

const ROLE_SEEDS = [
  {
    code: "SYSTEM_ADMIN",
    name: "System Administrator",
    description: "Full application and security administration access.",
    isSystem: true,
    permissions: PERMISSIONS.map(([code]) => code),
  },
  {
    code: "FRAUD_MANAGER",
    name: "Fraud Manager",
    description: "Manages fraud operations, assignments, statuses, and reports.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "cases.view",
      "cases.create",
      "cases.update",
      "cases.change_status",
      "cases.assign",
      "cases.upload_documents",
      "cases.download_documents",
      "cases.export_pdf",
      "reports.view",
      "reports.export",
      "fraud_assessment.view",
      "fraud_assessment.edit",
      "fraud_assessment.submit",
      "motor_fraud.view",
      "motor_fraud.upload_documents",
      "motor_fraud.download_documents",
      "motor_fraud.fraud_review",
      "motor_fraud.export",
      "users.view",
      "assistant.use",
      "assistant.view_case_status",
      "assistant.summarize_cases",
      "assistant.view_assigned_cases",
      "assistant.view_operational_statistics",
    ],
  },
  {
    code: "FRAUD_INVESTIGATOR",
    name: "Fraud Investigator",
    description: "Creates and investigates cases and maintains supporting evidence.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "cases.view",
      "cases.create",
      "cases.update",
      "cases.change_status",
      "cases.upload_documents",
      "cases.download_documents",
      "cases.export_pdf",
      "reports.view",
      "motor_fraud.view",
      "motor_fraud.upload_documents",
      "motor_fraud.download_documents",
      "motor_fraud.fraud_review",
      "motor_fraud.export",
      "assistant.use",
      "assistant.view_case_status",
      "assistant.summarize_cases",
      "assistant.view_assigned_cases",
      "assistant.view_operational_statistics",
    ],
  },
  {
    code: "MOTOR_AGENT",
    name: "Motor Fraud Agent",
    description: "Initiates Motor Fraud cases, provides documents, resubmits returned requests, and may close returned requests.",
    isSystem: true,
    permissions: [
      "motor_fraud.view",
      "motor_fraud.create",
      "motor_fraud.edit",
      "motor_fraud.submit",
      "motor_fraud.upload_documents",
      "motor_fraud.download_documents",
      "motor_fraud.close_returned",
      "motor_fraud.export",
    ],
  },
  {
    code: "LEGAL_REVIEWER",
    name: "Legal Motor Fraud Reviewer",
    description: "Reviews Motor Fraud referrals and approves or returns them to Motor.",
    isSystem: true,
    permissions: [
      "motor_fraud.view",
      "motor_fraud.upload_documents",
      "motor_fraud.download_documents",
      "motor_fraud.legal_review",
      "motor_fraud.export",
    ],
  },
  {
    code: "AUDITOR",
    name: "Auditor / Read Only",
    description: "Read-only access to cases, reports, documents, and audit evidence.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "cases.view",
      "cases.download_documents",
      "cases.export_pdf",
      "reports.view",
      "reports.export",
      "fraud_assessment.view",
      "audit.view",
      "assistant.use",
      "assistant.view_case_status",
      "assistant.summarize_cases",
      "assistant.view_operational_statistics",
    ],
  },
];

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRoleCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function legacyRoleForCode(roleCode) {
  return roleCode === "SYSTEM_ADMIN" ? "admin" : roleCode.toLowerCase();
}

async function ensureMssqlSchema() {
  const { sql, getPool } = require("./db-mssql");
  const db = await getPool();

  await db.request().query(`
    IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_code NVARCHAR(80) NOT NULL,
        role_name NVARCHAR(150) NOT NULL,
        description NVARCHAR(1000) NULL,
        is_system BIT NOT NULL CONSTRAINT DF_roles_is_system DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT DF_roles_is_active DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_roles_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_roles_updated_at DEFAULT SYSUTCDATETIME()
      );
      CREATE UNIQUE INDEX UX_roles_role_code ON dbo.roles(role_code);
    END;

    IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        permission_code NVARCHAR(120) NOT NULL,
        permission_name NVARCHAR(180) NOT NULL,
        module_name NVARCHAR(120) NOT NULL,
        description NVARCHAR(1000) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_permissions_created_at DEFAULT SYSUTCDATETIME()
      );
      CREATE UNIQUE INDEX UX_permissions_permission_code ON dbo.permissions(permission_code);
    END;

    IF OBJECT_ID(N'dbo.role_permissions', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_role_permissions_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE,
        CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES dbo.permissions(id) ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID(N'dbo.user_permission_overrides', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.user_permission_overrides (
        user_id INT NOT NULL,
        permission_id INT NOT NULL,
        is_allowed BIT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_permission_overrides_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_user_permission_overrides_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_user_permission_overrides PRIMARY KEY (user_id, permission_id),
        CONSTRAINT FK_user_permission_overrides_user FOREIGN KEY (user_id) REFERENCES dbo.app_users(id) ON DELETE CASCADE,
        CONSTRAINT FK_user_permission_overrides_permission FOREIGN KEY (permission_id) REFERENCES dbo.permissions(id) ON DELETE CASCADE
      );
    END;

    IF COL_LENGTH('dbo.app_users', 'username') IS NULL
      ALTER TABLE dbo.app_users ADD username NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.app_users', 'mobile_number') IS NULL
      ALTER TABLE dbo.app_users ADD mobile_number NVARCHAR(50) NULL;
    IF COL_LENGTH('dbo.app_users', 'auth_provider') IS NULL
      ALTER TABLE dbo.app_users ADD auth_provider NVARCHAR(30) NOT NULL CONSTRAINT DF_app_users_auth_provider DEFAULT N'local';
    IF COL_LENGTH('dbo.app_users', 'external_oid') IS NULL
      ALTER TABLE dbo.app_users ADD external_oid NVARCHAR(150) NULL;
    IF COL_LENGTH('dbo.app_users', 'role_id') IS NULL
      ALTER TABLE dbo.app_users ADD role_id INT NULL;
    IF COL_LENGTH('dbo.app_users', 'must_change_password') IS NULL
      ALTER TABLE dbo.app_users ADD must_change_password BIT NOT NULL CONSTRAINT DF_app_users_must_change_password DEFAULT (0);
    IF COL_LENGTH('dbo.app_users', 'token_version') IS NULL
      ALTER TABLE dbo.app_users ADD token_version INT NOT NULL CONSTRAINT DF_app_users_token_version DEFAULT (0);
    IF COL_LENGTH('dbo.app_users', 'last_login_at') IS NULL
      ALTER TABLE dbo.app_users ADD last_login_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.app_users', 'created_by') IS NULL
      ALTER TABLE dbo.app_users ADD created_by NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.app_users', 'updated_by') IS NULL
      ALTER TABLE dbo.app_users ADD updated_by NVARCHAR(255) NULL;

    IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_app_users_role'
    )
      ALTER TABLE dbo.app_users ADD CONSTRAINT FK_app_users_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id);
  `);

  for (const [code, name, moduleName, description] of PERMISSIONS) {
    await db
      .request()
      .input("code", sql.NVarChar(120), code)
      .input("name", sql.NVarChar(180), name)
      .input("moduleName", sql.NVarChar(120), moduleName)
      .input("description", sql.NVarChar(1000), description)
      .query(`
        MERGE dbo.permissions AS target
        USING (SELECT @code AS permission_code) AS source
        ON target.permission_code = source.permission_code
        WHEN MATCHED THEN UPDATE SET
          permission_name = @name,
          module_name = @moduleName,
          description = @description
        WHEN NOT MATCHED THEN
          INSERT (permission_code, permission_name, module_name, description)
          VALUES (@code, @name, @moduleName, @description);
      `);
  }

  for (const role of ROLE_SEEDS) {
    await db
      .request()
      .input("code", sql.NVarChar(80), role.code)
      .input("name", sql.NVarChar(150), role.name)
      .input("description", sql.NVarChar(1000), role.description)
      .input("isSystem", sql.Bit, role.isSystem ? 1 : 0)
      .query(`
        MERGE dbo.roles AS target
        USING (SELECT @code AS role_code) AS source
        ON target.role_code = source.role_code
        WHEN MATCHED THEN UPDATE SET
          role_name = @name,
          description = @description,
          is_system = @isSystem,
          is_active = 1,
          updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (role_code, role_name, description, is_system, is_active)
          VALUES (@code, @name, @description, @isSystem, 1);
      `);

    const roleResult = await db.request().input("code", sql.NVarChar(80), role.code).query(
      "SELECT id FROM dbo.roles WHERE role_code = @code"
    );
    const roleId = roleResult.recordset[0].id;

    for (const permissionCode of role.permissions) {
      await db
        .request()
        .input("roleId", sql.Int, roleId)
        .input("permissionCode", sql.NVarChar(120), permissionCode)
        .query(`
          INSERT INTO dbo.role_permissions (role_id, permission_id)
          SELECT @roleId, p.id
          FROM dbo.permissions p
          WHERE p.permission_code = @permissionCode
            AND NOT EXISTS (
              SELECT 1 FROM dbo.role_permissions rp
              WHERE rp.role_id = @roleId AND rp.permission_id = p.id
            );
        `);
    }
  }

  await db.request().query(`
    UPDATE u
    SET username = LEFT(email, CHARINDEX('@', email + '@') - 1)
    FROM dbo.app_users u
    WHERE username IS NULL OR LTRIM(RTRIM(username)) = '';

    UPDATE u
    SET role_id = r.id
    FROM dbo.app_users u
    INNER JOIN dbo.roles r
      ON r.role_code = CASE
        WHEN LOWER(ISNULL(u.role, '')) IN ('admin', 'system_admin', 'system administrator', 'system_administrator')
          THEN 'SYSTEM_ADMIN'
        ELSE 'FRAUD_INVESTIGATOR'
      END
    WHERE u.role_id IS NULL;
  `);
}

async function ensurePostgresSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_code VARCHAR(80) NOT NULL UNIQUE,
      role_name VARCHAR(150) NOT NULL,
      description VARCHAR(1000),
      is_system BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      permission_code VARCHAR(120) NOT NULL UNIQUE,
      permission_name VARCHAR(180) NOT NULL,
      module_name VARCHAR(120) NOT NULL,
      description VARCHAR(1000),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(50);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) NOT NULL DEFAULT 'local';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS external_oid VARCHAR(150);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      is_allowed BOOLEAN NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, permission_id)
    );
  `);

  for (const [code, name, moduleName, description] of PERMISSIONS) {
    await pool.query(
      `
      INSERT INTO permissions (permission_code, permission_name, module_name, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (permission_code) DO UPDATE SET
        permission_name = EXCLUDED.permission_name,
        module_name = EXCLUDED.module_name,
        description = EXCLUDED.description
      `,
      [code, name, moduleName, description]
    );
  }

  for (const role of ROLE_SEEDS) {
    const roleResult = await pool.query(
      `
      INSERT INTO roles (role_code, role_name, description, is_system, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (role_code) DO UPDATE SET
        role_name = EXCLUDED.role_name,
        description = EXCLUDED.description,
        is_system = EXCLUDED.is_system,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
      `,
      [role.code, role.name, role.description, role.isSystem]
    );
    const roleId = roleResult.rows[0].id;

    for (const permissionCode of role.permissions) {
      await pool.query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT $1::integer, p.id FROM permissions p WHERE p.permission_code = $2::text
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionCode]
      );
    }
  }

  await pool.query(`
    UPDATE app_users
    SET username = split_part(email, '@', 1)
    WHERE username IS NULL OR btrim(username) = '';

    UPDATE app_users u
    SET role_id = r.id
    FROM roles r
    WHERE u.role_id IS NULL
      AND r.role_code = CASE
        WHEN lower(COALESCE(u.role, '')) IN ('admin', 'system_admin', 'system administrator', 'system_administrator')
          THEN 'SYSTEM_ADMIN'
        ELSE 'FRAUD_INVESTIGATOR'
      END;
  `);
}

async function ensureRbacSchemaDb(pool) {
  if (isMssql()) return ensureMssqlSchema();
  return ensurePostgresSchema(pool);
}

async function getUserBaseByIdDb(pool, id, includePassword = false) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("id", sql.Int, Number(id))
      .query(`
        SELECT TOP 1
          u.id, u.full_name, u.username, u.email, u.mobile_number,
          ${includePassword ? "u.password_hash," : ""}
          u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
          u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
          u.created_by, u.updated_by,
          r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
          r.is_active AS role_is_active
        FROM dbo.app_users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        WHERE u.id = @id
      `);
    return result.recordset[0] || null;
  }

  const result = await pool.query(
    `
    SELECT
      u.id, u.full_name, u.username, u.email, u.mobile_number,
      ${includePassword ? "u.password_hash," : ""}
      u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
      u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
      u.created_by, u.updated_by,
      r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
      r.is_active AS role_is_active
    FROM app_users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = $1::integer
    LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function getUserBaseByEmailDb(pool, email, includePassword = false) {
  const normalizedEmail = normalizeEmail(email);
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("email", sql.NVarChar(255), normalizedEmail)
      .query(`
        SELECT TOP 1
          u.id, u.full_name, u.username, u.email, u.mobile_number,
          ${includePassword ? "u.password_hash," : ""}
          u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
          u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
          u.created_by, u.updated_by,
          r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
          r.is_active AS role_is_active
        FROM dbo.app_users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = LOWER(@email)
      `);
    return result.recordset[0] || null;
  }

  const result = await pool.query(
    `
    SELECT
      u.id, u.full_name, u.username, u.email, u.mobile_number,
      ${includePassword ? "u.password_hash," : ""}
      u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
      u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
      u.created_by, u.updated_by,
      r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
      r.is_active AS role_is_active
    FROM app_users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE lower(u.email) = lower($1::text)
    LIMIT 1
    `,
    [normalizedEmail]
  );
  return result.rows[0] || null;
}

async function getUserBaseByEmailOrOidDb(pool, email, oid) {
  const normalizedEmail = normalizeEmail(email);
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("email", sql.NVarChar(255), normalizedEmail)
      .input("oid", sql.NVarChar(150), oid || null)
      .query(`
        SELECT TOP 1
          u.id, u.full_name, u.username, u.email, u.mobile_number,
          u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
          u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
          u.created_by, u.updated_by,
          r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
          r.is_active AS role_is_active
        FROM dbo.app_users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = LOWER(@email)
           OR (@oid IS NOT NULL AND u.external_oid = @oid)
      `);
    return result.recordset[0] || null;
  }

  const result = await pool.query(
    `
    SELECT
      u.id, u.full_name, u.username, u.email, u.mobile_number,
      u.role AS legacy_role, u.role_id, u.is_active, u.auth_provider, u.external_oid,
      u.must_change_password, u.token_version, u.last_login_at, u.created_at, u.updated_at,
      u.created_by, u.updated_by,
      r.role_code, r.role_name, r.description AS role_description, r.is_system AS role_is_system,
      r.is_active AS role_is_active
    FROM app_users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE lower(u.email) = lower($1::text)
       OR ($2::text IS NOT NULL AND u.external_oid = $2::text)
    LIMIT 1
    `,
    [normalizedEmail, oid || null]
  );
  return result.rows[0] || null;
}

async function getEffectivePermissionCodesDb(pool, userId, roleId) {
  let roleCodes = [];
  let overrides = [];

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    if (roleId) {
      const roleResult = await db
        .request()
        .input("roleId", sql.Int, Number(roleId))
        .query(`
          SELECT p.permission_code
          FROM dbo.role_permissions rp
          INNER JOIN dbo.permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = @roleId
        `);
      roleCodes = roleResult.recordset.map((item) => item.permission_code);
    }
    const overrideResult = await db
      .request()
      .input("userId", sql.Int, Number(userId))
      .query(`
        SELECT p.permission_code, o.is_allowed
        FROM dbo.user_permission_overrides o
        INNER JOIN dbo.permissions p ON p.id = o.permission_id
        WHERE o.user_id = @userId
      `);
    overrides = overrideResult.recordset;
  } else {
    if (roleId) {
      const roleResult = await pool.query(
        `SELECT p.permission_code FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1::integer`,
        [roleId]
      );
      roleCodes = roleResult.rows.map((item) => item.permission_code);
    }
    const overrideResult = await pool.query(
      `SELECT p.permission_code, o.is_allowed FROM user_permission_overrides o INNER JOIN permissions p ON p.id = o.permission_id WHERE o.user_id = $1::integer`,
      [userId]
    );
    overrides = overrideResult.rows;
  }

  const effective = new Set(roleCodes);
  for (const override of overrides) {
    const allowed = override.is_allowed === true || override.is_allowed === 1;
    if (allowed) effective.add(override.permission_code);
    else effective.delete(override.permission_code);
  }
  return Array.from(effective).sort();
}

async function buildSecurityContextDb(pool, userRow, authMode = "local", extra = {}) {
  if (!userRow) return null;
  const active = userRow.is_active === true || userRow.is_active === 1;
  const roleActive = userRow.role_is_active === undefined || userRow.role_is_active === null || userRow.role_is_active === true || userRow.role_is_active === 1;
  if (!active || !roleActive) return null;

  const roleCode = userRow.role_code || normalizeRoleCode(userRow.legacy_role || "FRAUD_INVESTIGATOR");
  const effectivePermissions = await getEffectivePermissionCodesDb(pool, userRow.id, userRow.role_id);
  const isSystemAdministrator = roleCode === "SYSTEM_ADMIN";

  return {
    id: userRow.id,
    email: normalizeEmail(userRow.email),
    name: userRow.full_name || userRow.email,
    username: userRow.username || normalizeEmail(userRow.email).split("@")[0],
    mobileNumber: userRow.mobile_number || "",
    role: roleCode,
    roleCode,
    roleName: userRow.role_name || roleCode,
    roleId: userRow.role_id,
    permissions: isSystemAdministrator ? ["*"] : effectivePermissions,
    effectivePermissions,
    canManageSecurity: isSystemAdministrator || effectivePermissions.includes("users.manage_permissions") || effectivePermissions.includes("roles.manage_permissions"),
    authMode,
    authProvider: userRow.auth_provider || authMode,
    oid: extra.oid || userRow.external_oid || String(userRow.id),
    groups: extra.groups || [],
    tenantId: extra.tenantId,
    tokenVersion: Number(userRow.token_version || 0),
    mustChangePassword: userRow.must_change_password === true || userRow.must_change_password === 1,
  };
}

async function updateLastLoginDb(pool, userId) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    await db.request().input("id", sql.Int, Number(userId)).query("UPDATE dbo.app_users SET last_login_at = SYSUTCDATETIME() WHERE id = @id");
    return;
  }
  await pool.query("UPDATE app_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1::integer", [userId]);
}

async function getPermissionsDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db.request().query(`SELECT id, permission_code, permission_name, module_name, description FROM dbo.permissions ORDER BY module_name, permission_name`);
    return result.recordset;
  }
  const result = await pool.query(`SELECT id, permission_code, permission_name, module_name, description FROM permissions ORDER BY module_name, permission_name`);
  return result.rows;
}

async function getRolesDb(pool, includeInactive = true) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("includeInactive", sql.Bit, includeInactive ? 1 : 0)
      .query(`
        SELECT r.id, r.role_code, r.role_name, r.description, r.is_system, r.is_active, r.created_at, r.updated_at,
          (SELECT COUNT(*) FROM dbo.role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
          (SELECT COUNT(*) FROM dbo.app_users u WHERE u.role_id = r.id) AS user_count
        FROM dbo.roles r
        WHERE @includeInactive = 1 OR r.is_active = 1
        ORDER BY r.is_system DESC, r.role_name
      `);
    return result.recordset;
  }
  const result = await pool.query(
    `
    SELECT r.id, r.role_code, r.role_name, r.description, r.is_system, r.is_active, r.created_at, r.updated_at,
      (SELECT COUNT(*)::integer FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
      (SELECT COUNT(*)::integer FROM app_users u WHERE u.role_id = r.id) AS user_count
    FROM roles r
    WHERE $1::boolean OR r.is_active = true
    ORDER BY r.is_system DESC, r.role_name
    `,
    [includeInactive]
  );
  return result.rows;
}

async function getRoleByIdDb(pool, id) {
  let role;
  let permissionCodes;
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const roleResult = await db.request().input("id", sql.Int, Number(id)).query(`SELECT TOP 1 id, role_code, role_name, description, is_system, is_active, created_at, updated_at FROM dbo.roles WHERE id = @id`);
    role = roleResult.recordset[0];
    if (!role) return null;
    const permissionResult = await db.request().input("id", sql.Int, Number(id)).query(`SELECT p.permission_code FROM dbo.role_permissions rp INNER JOIN dbo.permissions p ON p.id = rp.permission_id WHERE rp.role_id = @id ORDER BY p.permission_code`);
    permissionCodes = permissionResult.recordset.map((item) => item.permission_code);
  } else {
    const roleResult = await pool.query(`SELECT id, role_code, role_name, description, is_system, is_active, created_at, updated_at FROM roles WHERE id = $1::integer LIMIT 1`, [id]);
    role = roleResult.rows[0];
    if (!role) return null;
    const permissionResult = await pool.query(`SELECT p.permission_code FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1::integer ORDER BY p.permission_code`, [id]);
    permissionCodes = permissionResult.rows.map((item) => item.permission_code);
  }
  return { ...role, permission_codes: permissionCodes };
}

async function getUsersDb(pool, filters = {}) {
  const search = String(filters.search || "").trim();
  const roleId = filters.roleId ? Number(filters.roleId) : null;
  const status = String(filters.status || "").trim().toLowerCase();
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db
      .request()
      .input("search", sql.NVarChar(255), search || null)
      .input("roleId", sql.Int, roleId)
      .input("status", sql.NVarChar(20), status || null)
      .query(`
        SELECT u.id, u.full_name, u.username, u.email, u.mobile_number, u.auth_provider, u.external_oid,
          u.role_id, u.is_active, u.must_change_password, u.last_login_at, u.created_at, u.updated_at,
          r.role_code, r.role_name
        FROM dbo.app_users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        WHERE (@search IS NULL OR u.full_name LIKE '%' + @search + '%' OR u.email LIKE '%' + @search + '%' OR u.username LIKE '%' + @search + '%')
          AND (@roleId IS NULL OR u.role_id = @roleId)
          AND (@status IS NULL OR (@status = 'active' AND u.is_active = 1) OR (@status = 'inactive' AND u.is_active = 0))
        ORDER BY u.full_name, u.email
      `);
    return result.recordset;
  }
  const result = await pool.query(
    `
    SELECT u.id, u.full_name, u.username, u.email, u.mobile_number, u.auth_provider, u.external_oid,
      u.role_id, u.is_active, u.must_change_password, u.last_login_at, u.created_at, u.updated_at,
      r.role_code, r.role_name
    FROM app_users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE ($1::text = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%')
      AND ($2::integer IS NULL OR u.role_id = $2)
      AND ($3::text = '' OR ($3 = 'active' AND u.is_active = true) OR ($3 = 'inactive' AND u.is_active = false))
    ORDER BY u.full_name, u.email
    `,
    [search, roleId, status]
  );
  return result.rows;
}

async function getUserByIdDb(pool, id) {
  const user = await getUserBaseByIdDb(pool, id, false);
  if (!user) return null;
  let overrides;
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db.request().input("id", sql.Int, Number(id)).query(`
      SELECT p.permission_code, o.is_allowed
      FROM dbo.user_permission_overrides o
      INNER JOIN dbo.permissions p ON p.id = o.permission_id
      WHERE o.user_id = @id
      ORDER BY p.permission_code
    `);
    overrides = result.recordset;
  } else {
    const result = await pool.query(`SELECT p.permission_code, o.is_allowed FROM user_permission_overrides o INNER JOIN permissions p ON p.id = o.permission_id WHERE o.user_id = $1::integer ORDER BY p.permission_code`, [id]);
    overrides = result.rows;
  }
  const effectivePermissions = await getEffectivePermissionCodesDb(pool, user.id, user.role_id);
  return {
    ...user,
    permission_overrides: overrides.map((item) => ({ permission_code: item.permission_code, is_allowed: item.is_allowed === true || item.is_allowed === 1 })),
    effective_permissions: user.role_code === "SYSTEM_ADMIN" ? PERMISSIONS.map(([code]) => code) : effectivePermissions,
  };
}

async function assertUniqueUserDb(pool, { email, username, excludeId = null }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = String(username || "").trim().toLowerCase();
  let rows;
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db.request()
      .input("email", sql.NVarChar(255), normalizedEmail)
      .input("username", sql.NVarChar(100), normalizedUsername)
      .input("excludeId", sql.Int, excludeId ? Number(excludeId) : null)
      .query(`SELECT id, email, username FROM dbo.app_users WHERE (@excludeId IS NULL OR id <> @excludeId) AND (LOWER(email) = LOWER(@email) OR LOWER(username) = LOWER(@username))`);
    rows = result.recordset;
  } else {
    const result = await pool.query(`SELECT id, email, username FROM app_users WHERE ($3::integer IS NULL OR id <> $3) AND (lower(email) = lower($1) OR lower(username) = lower($2))`, [normalizedEmail, normalizedUsername, excludeId ? Number(excludeId) : null]);
    rows = result.rows;
  }
  if (rows.some((row) => normalizeEmail(row.email) === normalizedEmail)) {
    const error = new Error("A user with this email already exists.");
    error.statusCode = 409;
    throw error;
  }
  if (rows.some((row) => String(row.username || "").trim().toLowerCase() === normalizedUsername)) {
    const error = new Error("A user with this username already exists.");
    error.statusCode = 409;
    throw error;
  }
}

async function getRoleCodeByIdDb(pool, roleId) {
  const role = await getRoleByIdDb(pool, roleId);
  return role?.role_code || null;
}

async function createUserDb(pool, data, actorEmail) {
  await assertUniqueUserDb(pool, data);
  const roleCode = await getRoleCodeByIdDb(pool, data.role_id);
  if (!roleCode) {
    const error = new Error("Selected role does not exist.");
    error.statusCode = 400;
    throw error;
  }
  const authProvider = data.auth_provider || "local";
  const passwordHash = data.password_hash || (await bcrypt.hash(`DISABLED-${Date.now()}-${Math.random()}`, 10));
  let id;
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db.request()
      .input("fullName", sql.NVarChar(150), data.full_name)
      .input("username", sql.NVarChar(100), data.username)
      .input("email", sql.NVarChar(255), normalizeEmail(data.email))
      .input("mobile", sql.NVarChar(50), data.mobile_number || null)
      .input("passwordHash", sql.NVarChar(sql.MAX), passwordHash)
      .input("role", sql.NVarChar(50), legacyRoleForCode(roleCode))
      .input("roleId", sql.Int, Number(data.role_id))
      .input("active", sql.Bit, data.is_active === false ? 0 : 1)
      .input("authProvider", sql.NVarChar(30), authProvider)
      .input("externalOid", sql.NVarChar(150), data.external_oid || null)
      .input("mustChange", sql.Bit, data.must_change_password ? 1 : 0)
      .input("actor", sql.NVarChar(255), actorEmail || null)
      .query(`
        INSERT INTO dbo.app_users (full_name, username, email, mobile_number, password_hash, role, role_id, is_active, auth_provider, external_oid, must_change_password, created_by, updated_by)
        OUTPUT INSERTED.id
        VALUES (@fullName, @username, @email, @mobile, @passwordHash, @role, @roleId, @active, @authProvider, @externalOid, @mustChange, @actor, @actor)
      `);
    id = result.recordset[0].id;
  } else {
    const result = await pool.query(
      `
      INSERT INTO app_users (full_name, username, email, mobile_number, password_hash, role, role_id, is_active, auth_provider, external_oid, must_change_password, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      RETURNING id
      `,
      [data.full_name, data.username, normalizeEmail(data.email), data.mobile_number || null, passwordHash, legacyRoleForCode(roleCode), data.role_id, data.is_active !== false, authProvider, data.external_oid || null, Boolean(data.must_change_password), actorEmail || null]
    );
    id = result.rows[0].id;
  }
  return getUserByIdDb(pool, id);
}

async function updateUserDb(pool, id, data, actorEmail) {
  const existing = await getUserByIdDb(pool, id);
  if (!existing) return null;
  const email = data.email ?? existing.email;
  const username = data.username ?? existing.username;
  await assertUniqueUserDb(pool, { email, username, excludeId: id });
  const roleId = data.role_id ?? existing.role_id;
  const roleCode = await getRoleCodeByIdDb(pool, roleId);
  if (!roleCode) {
    const error = new Error("Selected role does not exist.");
    error.statusCode = 400;
    throw error;
  }
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    await db.request()
      .input("id", sql.Int, Number(id))
      .input("fullName", sql.NVarChar(150), data.full_name ?? existing.full_name)
      .input("username", sql.NVarChar(100), username)
      .input("email", sql.NVarChar(255), normalizeEmail(email))
      .input("mobile", sql.NVarChar(50), data.mobile_number ?? existing.mobile_number ?? null)
      .input("role", sql.NVarChar(50), legacyRoleForCode(roleCode))
      .input("roleId", sql.Int, Number(roleId))
      .input("authProvider", sql.NVarChar(30), data.auth_provider ?? existing.auth_provider ?? "local")
      .input("externalOid", sql.NVarChar(150), data.external_oid ?? existing.external_oid ?? null)
      .input("mustChange", sql.Bit, data.must_change_password === undefined ? (existing.must_change_password ? 1 : 0) : (data.must_change_password ? 1 : 0))
      .input("actor", sql.NVarChar(255), actorEmail || null)
      .query(`
        UPDATE dbo.app_users SET full_name=@fullName, username=@username, email=@email, mobile_number=@mobile,
          role=@role, role_id=@roleId, auth_provider=@authProvider, external_oid=@externalOid,
          must_change_password=@mustChange, updated_by=@actor, updated_at=SYSUTCDATETIME()
        WHERE id=@id
      `);
  } else {
    await pool.query(
      `
      UPDATE app_users SET full_name=$2, username=$3, email=$4, mobile_number=$5, role=$6, role_id=$7,
        auth_provider=$8, external_oid=$9, must_change_password=$10, updated_by=$11, updated_at=CURRENT_TIMESTAMP
      WHERE id=$1::integer
      `,
      [id, data.full_name ?? existing.full_name, username, normalizeEmail(email), data.mobile_number ?? existing.mobile_number ?? null, legacyRoleForCode(roleCode), roleId, data.auth_provider ?? existing.auth_provider ?? "local", data.external_oid ?? existing.external_oid ?? null, data.must_change_password === undefined ? Boolean(existing.must_change_password) : Boolean(data.must_change_password), actorEmail || null]
    );
  }
  return getUserByIdDb(pool, id);
}

async function setUserActiveDb(pool, id, isActive, actorEmail) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    await db.request().input("id", sql.Int, Number(id)).input("active", sql.Bit, isActive ? 1 : 0).input("actor", sql.NVarChar(255), actorEmail || null).query(`UPDATE dbo.app_users SET is_active=@active, token_version=token_version+1, updated_by=@actor, updated_at=SYSUTCDATETIME() WHERE id=@id`);
  } else {
    await pool.query(`UPDATE app_users SET is_active=$2::boolean, token_version=token_version+1, updated_by=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1::integer`, [id, isActive, actorEmail || null]);
  }
  return getUserByIdDb(pool, id);
}

async function resetUserPasswordDb(pool, id, passwordHash, mustChangePassword, actorEmail) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    await db.request().input("id", sql.Int, Number(id)).input("hash", sql.NVarChar(sql.MAX), passwordHash).input("mustChange", sql.Bit, mustChangePassword ? 1 : 0).input("actor", sql.NVarChar(255), actorEmail || null).query(`UPDATE dbo.app_users SET password_hash=@hash, must_change_password=@mustChange, token_version=token_version+1, updated_by=@actor, updated_at=SYSUTCDATETIME() WHERE id=@id`);
  } else {
    await pool.query(`UPDATE app_users SET password_hash=$2, must_change_password=$3, token_version=token_version+1, updated_by=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1::integer`, [id, passwordHash, mustChangePassword, actorEmail || null]);
  }
  return getUserByIdDb(pool, id);
}

async function setUserPermissionOverridesDb(pool, userId, overrides) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const transaction = new sql.Transaction(db);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("userId", sql.Int, Number(userId)).query(`DELETE FROM dbo.user_permission_overrides WHERE user_id=@userId`);
      for (const override of overrides) {
        await new sql.Request(transaction)
          .input("userId", sql.Int, Number(userId))
          .input("permissionCode", sql.NVarChar(120), override.permission_code)
          .input("allowed", sql.Bit, override.is_allowed ? 1 : 0)
          .query(`
            INSERT INTO dbo.user_permission_overrides (user_id, permission_id, is_allowed)
            SELECT @userId, id, @allowed FROM dbo.permissions WHERE permission_code=@permissionCode
          `);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM user_permission_overrides WHERE user_id=$1::integer`, [userId]);
      for (const override of overrides) {
        await client.query(`INSERT INTO user_permission_overrides (user_id, permission_id, is_allowed) SELECT $1::integer, id, $3::boolean FROM permissions WHERE permission_code=$2::text`, [userId, override.permission_code, Boolean(override.is_allowed)]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return getUserByIdDb(pool, userId);
}

async function createRoleDb(pool, data) {
  const code = normalizeRoleCode(data.role_code);
  try {
    let id;
    if (isMssql()) {
      const { sql, getPool } = require("./db-mssql");
      const db = await getPool();
      const result = await db.request().input("code", sql.NVarChar(80), code).input("name", sql.NVarChar(150), data.role_name).input("description", sql.NVarChar(1000), data.description || null).query(`INSERT INTO dbo.roles (role_code, role_name, description, is_system, is_active) OUTPUT INSERTED.id VALUES (@code,@name,@description,0,1)`);
      id = result.recordset[0].id;
    } else {
      const result = await pool.query(`INSERT INTO roles (role_code, role_name, description, is_system, is_active) VALUES ($1,$2,$3,false,true) RETURNING id`, [code, data.role_name, data.description || null]);
      id = result.rows[0].id;
    }
    return getRoleByIdDb(pool, id);
  } catch (error) {
    if (String(error.message).toLowerCase().includes("unique") || String(error.message).toLowerCase().includes("duplicate")) {
      const conflict = new Error("A role with this code already exists.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
}

async function updateRoleDb(pool, id, data) {
  const existing = await getRoleByIdDb(pool, id);
  if (!existing) return null;
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    await db.request().input("id", sql.Int, Number(id)).input("name", sql.NVarChar(150), data.role_name ?? existing.role_name).input("description", sql.NVarChar(1000), data.description ?? existing.description ?? null).input("active", sql.Bit, data.is_active === undefined ? (existing.is_active ? 1 : 0) : (data.is_active ? 1 : 0)).query(`UPDATE dbo.roles SET role_name=@name, description=@description, is_active=@active, updated_at=SYSUTCDATETIME() WHERE id=@id`);
  } else {
    await pool.query(`UPDATE roles SET role_name=$2, description=$3, is_active=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1::integer`, [id, data.role_name ?? existing.role_name, data.description ?? existing.description ?? null, data.is_active === undefined ? Boolean(existing.is_active) : Boolean(data.is_active)]);
  }
  return getRoleByIdDb(pool, id);
}

async function setRolePermissionsDb(pool, roleId, permissionCodes) {
  const role = await getRoleByIdDb(pool, roleId);
  if (!role) return null;
  if (role.role_code === "SYSTEM_ADMIN") {
    const error = new Error("System Administrator permissions are fixed and cannot be reduced.");
    error.statusCode = 400;
    throw error;
  }
  const uniqueCodes = Array.from(new Set(permissionCodes));
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();
    const transaction = new sql.Transaction(db);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("roleId", sql.Int, Number(roleId)).query(`DELETE FROM dbo.role_permissions WHERE role_id=@roleId`);
      for (const code of uniqueCodes) {
        await new sql.Request(transaction).input("roleId", sql.Int, Number(roleId)).input("code", sql.NVarChar(120), code).query(`INSERT INTO dbo.role_permissions (role_id, permission_id) SELECT @roleId,id FROM dbo.permissions WHERE permission_code=@code`);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM role_permissions WHERE role_id=$1::integer`, [roleId]);
      for (const code of uniqueCodes) {
        await client.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT $1::integer,id FROM permissions WHERE permission_code=$2::text`, [roleId, code]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return getRoleByIdDb(pool, roleId);
}

async function countActiveSystemAdministratorsDb(pool) {
  if (isMssql()) {
    const { getPool } = require("./db-mssql");
    const db = await getPool();
    const result = await db.request().query(`SELECT COUNT(*) AS count FROM dbo.app_users u INNER JOIN dbo.roles r ON r.id=u.role_id WHERE u.is_active=1 AND r.role_code='SYSTEM_ADMIN'`);
    return Number(result.recordset[0].count || 0);
  }
  const result = await pool.query(`SELECT COUNT(*)::integer AS count FROM app_users u INNER JOIN roles r ON r.id=u.role_id WHERE u.is_active=true AND r.role_code='SYSTEM_ADMIN'`);
  return Number(result.rows[0].count || 0);
}

module.exports = {
  PERMISSIONS,
  ROLE_SEEDS,
  ensureRbacSchemaDb,
  getUserBaseByIdDb,
  getUserBaseByEmailDb,
  getUserBaseByEmailOrOidDb,
  buildSecurityContextDb,
  updateLastLoginDb,
  getPermissionsDb,
  getRolesDb,
  getRoleByIdDb,
  getUsersDb,
  getUserByIdDb,
  createUserDb,
  updateUserDb,
  setUserActiveDb,
  resetUserPasswordDb,
  setUserPermissionOverridesDb,
  createRoleDb,
  updateRoleDb,
  setRolePermissionsDb,
  countActiveSystemAdministratorsDb,
};
