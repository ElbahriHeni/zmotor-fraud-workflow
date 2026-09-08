/* Motor Fraud workflow schema. Safe to run more than once. */
IF OBJECT_ID(N'dbo.motor_fraud_cases', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.motor_fraud_cases (
    id INT IDENTITY(1,1) PRIMARY KEY,
    case_number NVARCHAR(80) NOT NULL,
    claim_number NVARCHAR(120) NOT NULL,
    reserve_amount DECIMAL(18,2) NULL,
    accident_number NVARCHAR(120) NULL,
    claim_type NVARCHAR(180) NULL,
    indicator_classification NVARCHAR(50) NULL,
    sub_indicator NVARCHAR(MAX) NULL,
    main_indicator NVARCHAR(255) NULL,
    indicator_source NVARCHAR(255) NULL,
    action_taken NVARCHAR(MAX) NULL,
    received_date DATE NULL,
    comment_date DATE NULL,
    administrative_entity NVARCHAR(255) NULL,
    employee_name NVARCHAR(255) NULL,
    objection_received_date DATE NULL,
    first_escalation_at DATETIME2 NULL,
    second_escalation_at DATETIME2 NULL,
    status NVARCHAR(60) NOT NULL DEFAULT N'Draft',
    current_team NVARCHAR(30) NOT NULL DEFAULT N'MOTOR',
    return_to_team NVARCHAR(30) NULL,
    created_by NVARCHAR(255) NOT NULL,
    created_by_name NVARCHAR(255) NULL,
    updated_by NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    closed_at DATETIME2 NULL,
    closed_by NVARCHAR(255) NULL,
    closure_outcome NVARCHAR(80) NULL
  );
  CREATE UNIQUE INDEX UX_motor_fraud_case_number ON dbo.motor_fraud_cases(case_number);
  CREATE INDEX IX_motor_fraud_claim_number ON dbo.motor_fraud_cases(claim_number);
  CREATE INDEX IX_motor_fraud_status ON dbo.motor_fraud_cases(status, current_team);
  CREATE INDEX IX_motor_fraud_created_by ON dbo.motor_fraud_cases(created_by);
END;

IF OBJECT_ID(N'dbo.motor_fraud_documents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.motor_fraud_documents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    motor_fraud_case_id INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_type NVARCHAR(150) NULL,
    file_size INT NULL,
    file_data VARBINARY(MAX) NOT NULL,
    category NVARCHAR(100) NULL,
    uploaded_by NVARCHAR(255) NULL,
    uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_motor_fraud_documents_case FOREIGN KEY (motor_fraud_case_id)
      REFERENCES dbo.motor_fraud_cases(id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.motor_fraud_history', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.motor_fraud_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    motor_fraud_case_id INT NOT NULL,
    action_code NVARCHAR(80) NOT NULL,
    from_status NVARCHAR(60) NULL,
    to_status NVARCHAR(60) NULL,
    from_team NVARCHAR(30) NULL,
    to_team NVARCHAR(30) NULL,
    actor_email NVARCHAR(255) NULL,
    actor_name NVARCHAR(255) NULL,
    actor_team NVARCHAR(30) NULL,
    public_message NVARCHAR(MAX) NULL,
    internal_comment NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_motor_fraud_history_case FOREIGN KEY (motor_fraud_case_id)
      REFERENCES dbo.motor_fraud_cases(id) ON DELETE CASCADE
  );
END;

/* Permissions and system roles are also seeded automatically by db-rbac.js at backend startup. */
