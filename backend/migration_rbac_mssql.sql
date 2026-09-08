-- Fraud Management RBAC migration for Microsoft SQL Server
-- Safe to run repeatedly. Back up the database before production deployment.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.app_users', N'U') IS NULL
  THROW 50001, 'Required table dbo.app_users does not exist.', 1;

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

IF COL_LENGTH('dbo.app_users', 'username') IS NULL ALTER TABLE dbo.app_users ADD username NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.app_users', 'mobile_number') IS NULL ALTER TABLE dbo.app_users ADD mobile_number NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.app_users', 'auth_provider') IS NULL ALTER TABLE dbo.app_users ADD auth_provider NVARCHAR(30) NOT NULL CONSTRAINT DF_app_users_auth_provider DEFAULT N'local';
IF COL_LENGTH('dbo.app_users', 'external_oid') IS NULL ALTER TABLE dbo.app_users ADD external_oid NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.app_users', 'role_id') IS NULL ALTER TABLE dbo.app_users ADD role_id INT NULL;
IF COL_LENGTH('dbo.app_users', 'must_change_password') IS NULL ALTER TABLE dbo.app_users ADD must_change_password BIT NOT NULL CONSTRAINT DF_app_users_must_change_password DEFAULT (0);
IF COL_LENGTH('dbo.app_users', 'token_version') IS NULL ALTER TABLE dbo.app_users ADD token_version INT NOT NULL CONSTRAINT DF_app_users_token_version DEFAULT (0);
IF COL_LENGTH('dbo.app_users', 'last_login_at') IS NULL ALTER TABLE dbo.app_users ADD last_login_at DATETIME2 NULL;
IF COL_LENGTH('dbo.app_users', 'created_by') IS NULL ALTER TABLE dbo.app_users ADD created_by NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.app_users', 'updated_by') IS NULL ALTER TABLE dbo.app_users ADD updated_by NVARCHAR(255) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_app_users_role')
  ALTER TABLE dbo.app_users ADD CONSTRAINT FK_app_users_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id);

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

MERGE dbo.permissions AS target
USING (VALUES
      (N'dashboard.view', N'View Dashboard', N'Dashboard', N'Open the operational dashboard.'),
      (N'cases.view', N'View Cases', N'Cases', N'View fraud cases and case history.'),
      (N'cases.create', N'Create Cases', N'Cases', N'Create and save fraud cases.'),
      (N'cases.update', N'Update Cases', N'Cases', N'Edit fraud case information.'),
      (N'cases.change_status', N'Change Case Status', N'Cases', N'Open, suspend, or close fraud cases.'),
      (N'cases.assign', N'Assign Cases', N'Cases', N'Assign, reassign, or release cases.'),
      (N'cases.upload_documents', N'Upload Documents', N'Cases', N'Upload or register case documents.'),
      (N'cases.download_documents', N'Download Documents', N'Cases', N'View and download case documents.'),
      (N'cases.export_pdf', N'Export Case PDF', N'Cases', N'Export a fraud case as PDF.'),
      (N'reports.view', N'View Reports', N'Reports', N'Open fraud reports.'),
      (N'reports.export', N'Export Reports', N'Reports', N'Export filtered report results.'),
      (N'users.view', N'View Users', N'User Management', N'View application users.'),
      (N'users.create', N'Create Users', N'User Management', N'Create application users.'),
      (N'users.update', N'Update Users', N'User Management', N'Edit application users and roles.'),
      (N'users.activate', N'Activate or Deactivate Users', N'User Management', N'Control whether users can sign in.'),
      (N'users.reset_password', N'Reset Passwords', N'User Management', N'Reset local user passwords.'),
      (N'users.manage_permissions', N'Manage User Permissions', N'User Management', N'Grant or deny user-level permission overrides.'),
      (N'roles.view', N'View Roles', N'Role Management', N'View roles and their permissions.'),
      (N'roles.create', N'Create Roles', N'Role Management', N'Create configurable application roles.'),
      (N'roles.update', N'Update Roles', N'Role Management', N'Edit role details and activation status.'),
      (N'roles.manage_permissions', N'Manage Role Permissions', N'Role Management', N'Configure permissions assigned to roles.'),
      (N'audit.view', N'View Audit Log', N'Audit & Compliance', N'Review security and business activity.'),
      (N'assistant.use', N'Use Intelligent Assistant', N'Intelligent Assistant', N'Open the read-only in-application assistant.'),
      (N'assistant.view_case_status', N'Assistant Case Status Lookup', N'Intelligent Assistant', N'Ask the assistant for the current status of authorized cases.'),
      (N'assistant.summarize_cases', N'Assistant Case Summaries', N'Intelligent Assistant', N'Ask the assistant to summarize authorized cases without personal reporter data.'),
      (N'assistant.view_assigned_cases', N'Assistant Assigned Cases', N'Intelligent Assistant', N'Ask the assistant to list cases assigned to the signed-in user.'),
      (N'assistant.view_operational_statistics', N'Assistant Operational Statistics', N'Intelligent Assistant', N'Ask the assistant for authorized case status counts.')
) AS source(permission_code, permission_name, module_name, description)
ON target.permission_code=source.permission_code
WHEN MATCHED THEN UPDATE SET permission_name=source.permission_name, module_name=source.module_name, description=source.description
WHEN NOT MATCHED THEN INSERT(permission_code, permission_name, module_name, description)
VALUES(source.permission_code, source.permission_name, source.module_name, source.description);

MERGE dbo.roles AS target
USING (VALUES
      (N'SYSTEM_ADMIN', N'System Administrator', N'Full application and security administration access.', 1),
      (N'FRAUD_MANAGER', N'Fraud Manager', N'Manages fraud operations, assignments, statuses, and reports.', 1),
      (N'FRAUD_INVESTIGATOR', N'Fraud Investigator', N'Creates and investigates cases and maintains supporting evidence.', 1),
      (N'AUDITOR', N'Auditor / Read Only', N'Read-only access to cases, reports, documents, and audit evidence.', 1)
) AS source(role_code, role_name, description, is_system)
ON target.role_code=source.role_code
WHEN MATCHED THEN UPDATE SET role_name=source.role_name, description=source.description, is_system=source.is_system, is_active=1, updated_at=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT(role_code, role_name, description, is_system, is_active)
VALUES(source.role_code, source.role_name, source.description, source.is_system, 1);

INSERT INTO dbo.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
      (N'SYSTEM_ADMIN', N'dashboard.view'),
      (N'SYSTEM_ADMIN', N'cases.view'),
      (N'SYSTEM_ADMIN', N'cases.create'),
      (N'SYSTEM_ADMIN', N'cases.update'),
      (N'SYSTEM_ADMIN', N'cases.change_status'),
      (N'SYSTEM_ADMIN', N'cases.assign'),
      (N'SYSTEM_ADMIN', N'cases.upload_documents'),
      (N'SYSTEM_ADMIN', N'cases.download_documents'),
      (N'SYSTEM_ADMIN', N'cases.export_pdf'),
      (N'SYSTEM_ADMIN', N'reports.view'),
      (N'SYSTEM_ADMIN', N'reports.export'),
      (N'SYSTEM_ADMIN', N'users.view'),
      (N'SYSTEM_ADMIN', N'users.create'),
      (N'SYSTEM_ADMIN', N'users.update'),
      (N'SYSTEM_ADMIN', N'users.activate'),
      (N'SYSTEM_ADMIN', N'users.reset_password'),
      (N'SYSTEM_ADMIN', N'users.manage_permissions'),
      (N'SYSTEM_ADMIN', N'roles.view'),
      (N'SYSTEM_ADMIN', N'roles.create'),
      (N'SYSTEM_ADMIN', N'roles.update'),
      (N'SYSTEM_ADMIN', N'roles.manage_permissions'),
      (N'SYSTEM_ADMIN', N'audit.view'),
      (N'SYSTEM_ADMIN', N'assistant.use'),
      (N'SYSTEM_ADMIN', N'assistant.view_case_status'),
      (N'SYSTEM_ADMIN', N'assistant.summarize_cases'),
      (N'SYSTEM_ADMIN', N'assistant.view_assigned_cases'),
      (N'SYSTEM_ADMIN', N'assistant.view_operational_statistics'),
      (N'FRAUD_MANAGER', N'dashboard.view'),
      (N'FRAUD_MANAGER', N'cases.view'),
      (N'FRAUD_MANAGER', N'cases.create'),
      (N'FRAUD_MANAGER', N'cases.update'),
      (N'FRAUD_MANAGER', N'cases.change_status'),
      (N'FRAUD_MANAGER', N'cases.assign'),
      (N'FRAUD_MANAGER', N'cases.upload_documents'),
      (N'FRAUD_MANAGER', N'cases.download_documents'),
      (N'FRAUD_MANAGER', N'cases.export_pdf'),
      (N'FRAUD_MANAGER', N'reports.view'),
      (N'FRAUD_MANAGER', N'reports.export'),
      (N'FRAUD_MANAGER', N'users.view'),
      (N'FRAUD_MANAGER', N'assistant.use'),
      (N'FRAUD_MANAGER', N'assistant.view_case_status'),
      (N'FRAUD_MANAGER', N'assistant.summarize_cases'),
      (N'FRAUD_MANAGER', N'assistant.view_assigned_cases'),
      (N'FRAUD_MANAGER', N'assistant.view_operational_statistics'),
      (N'FRAUD_INVESTIGATOR', N'dashboard.view'),
      (N'FRAUD_INVESTIGATOR', N'cases.view'),
      (N'FRAUD_INVESTIGATOR', N'cases.create'),
      (N'FRAUD_INVESTIGATOR', N'cases.update'),
      (N'FRAUD_INVESTIGATOR', N'cases.change_status'),
      (N'FRAUD_INVESTIGATOR', N'cases.upload_documents'),
      (N'FRAUD_INVESTIGATOR', N'cases.download_documents'),
      (N'FRAUD_INVESTIGATOR', N'cases.export_pdf'),
      (N'FRAUD_INVESTIGATOR', N'reports.view'),
      (N'FRAUD_INVESTIGATOR', N'assistant.use'),
      (N'FRAUD_INVESTIGATOR', N'assistant.view_case_status'),
      (N'FRAUD_INVESTIGATOR', N'assistant.summarize_cases'),
      (N'FRAUD_INVESTIGATOR', N'assistant.view_assigned_cases'),
      (N'FRAUD_INVESTIGATOR', N'assistant.view_operational_statistics'),
      (N'AUDITOR', N'dashboard.view'),
      (N'AUDITOR', N'cases.view'),
      (N'AUDITOR', N'cases.download_documents'),
      (N'AUDITOR', N'cases.export_pdf'),
      (N'AUDITOR', N'reports.view'),
      (N'AUDITOR', N'reports.export'),
      (N'AUDITOR', N'audit.view'),
      (N'AUDITOR', N'assistant.use'),
      (N'AUDITOR', N'assistant.view_case_status'),
      (N'AUDITOR', N'assistant.summarize_cases'),
      (N'AUDITOR', N'assistant.view_operational_statistics')
) source(role_code, permission_code)
JOIN dbo.roles r ON r.role_code=source.role_code
JOIN dbo.permissions p ON p.permission_code=source.permission_code
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id
);

UPDATE dbo.app_users
SET username=LEFT(email, CHARINDEX('@', email + '@') - 1)
WHERE username IS NULL OR LTRIM(RTRIM(username))='';

UPDATE u
SET role_id=r.id
FROM dbo.app_users u
JOIN dbo.roles r ON r.role_code=CASE
  WHEN LOWER(ISNULL(u.role,'')) IN ('admin','system_admin','system administrator','system_administrator') THEN 'SYSTEM_ADMIN'
  ELSE 'FRAUD_INVESTIGATOR'
END
WHERE u.role_id IS NULL;

COMMIT TRANSACTION;
