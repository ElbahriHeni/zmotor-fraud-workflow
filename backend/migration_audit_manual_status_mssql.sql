/* Run once against the Fraud Management MSSQL database. */

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
