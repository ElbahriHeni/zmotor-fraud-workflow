-- Fraud Management System - Microsoft SQL Server Schema
-- Target: Microsoft SQL Server
-- Purpose: Initial schema for customer production direction.
-- Notes:
--   - Documents are stored in SQL Server using VARBINARY(MAX).
--   - This schema is the MSSQL equivalent of the current PostgreSQL demo schema.
--   - Run this in SQL Server Management Studio (SSMS) or Azure Data Studio.

IF DB_ID(N'FraudManagementDB') IS NULL
BEGIN
    CREATE DATABASE FraudManagementDB;
END;
GO

USE FraudManagementDB;
GO

-- =========================================================
-- 1. Fraud Cases
-- =========================================================
IF OBJECT_ID(N'dbo.fraud_cases', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.fraud_cases (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,

        -- Case identity
        case_number NVARCHAR(80) NOT NULL UNIQUE,
        case_status NVARCHAR(50) NULL DEFAULT N'Draft',
        case_entry_date DATETIME2 NULL DEFAULT SYSUTCDATETIME(),

        -- Reporter details
        reporter_name NVARCHAR(150) NULL,
        reporter_email NVARCHAR(255) NULL,
        reporter_mobile NVARCHAR(50) NULL,
        national_id_or_iqama NVARCHAR(50) NULL,
        consent_to_terms_and_privacy BIT NOT NULL DEFAULT 0,

        -- Case overview
        claim_id NVARCHAR(100) NULL,
        case_type NVARCHAR(100) NULL,
        case_source NVARCHAR(100) NULL,
        case_source_other NVARCHAR(MAX) NULL,
        priority_level NVARCHAR(50) NULL,
        insurance_type NVARCHAR(100) NULL,
        suspected_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        description NVARCHAR(MAX) NULL,

        -- Claim information
        has_claim BIT NOT NULL DEFAULT 0,
        claim_type NVARCHAR(150) NULL,
        claim_status NVARCHAR(50) NULL,
        suspension_date DATETIME2 NULL,
        suspension_reason NVARCHAR(MAX) NULL,

        -- Fraud indicators / confirmed fraud
        fraud_confirmed_date DATETIME2 NULL,
        fraud_detection_method NVARCHAR(MAX) NULL,
        fraud_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        action_taken NVARCHAR(MAX) NULL,
        referred_entity NVARCHAR(MAX) NULL,
        fraud_indicator_type NVARCHAR(MAX) NULL,
        indicator_description NVARCHAR(MAX) NULL,
        occurrence_count INT NOT NULL DEFAULT 0,
        risk_score INT NOT NULL DEFAULT 0,
        risk_level NVARCHAR(50) NULL,
        system_recommendation NVARCHAR(MAX) NULL,

        fraud_unit_notes NVARCHAR(MAX) NULL,
        assigned_user NVARCHAR(150) NULL,
        assignment_date DATETIME2 NULL,
        assigned_by NVARCHAR(150) NULL,
        reassignment_reason NVARCHAR(MAX) NULL,
        closure_date DATETIME2 NULL,
        closure_reason NVARCHAR(MAX) NULL,

        -- Ownership and audit metadata
        created_by NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- =========================================================
-- 2. Case Action Logs
-- =========================================================
IF OBJECT_ID(N'dbo.case_action_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.case_action_logs (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        fraud_case_id INT NOT NULL,
        responsible_user NVARCHAR(150) NULL,
        status NVARCHAR(100) NULL,
        action_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_case_action_logs_fraud_cases
            FOREIGN KEY (fraud_case_id) REFERENCES dbo.fraud_cases(id)
            ON DELETE CASCADE
    );
END;
GO

-- =========================================================
-- 3. Case Documents
-- =========================================================
IF OBJECT_ID(N'dbo.case_documents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.case_documents (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        fraud_case_id INT NOT NULL,

        file_name NVARCHAR(255) NOT NULL,
        file_type NVARCHAR(150) NULL,
        file_url NVARCHAR(MAX) NULL,
        storage_path NVARCHAR(MAX) NULL,

        -- Microsoft SQL Server document storage
        file_size INT NULL,
        file_data VARBINARY(MAX) NULL,

        category NVARCHAR(100) NULL,
        uploaded_by NVARCHAR(150) NULL,
        uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_case_documents_fraud_cases
            FOREIGN KEY (fraud_case_id) REFERENCES dbo.fraud_cases(id)
            ON DELETE CASCADE
    );
END;
GO

-- =========================================================
-- 4. Local Application Users
-- =========================================================
-- Keep this for demo/local authentication mode only.
-- For customer production AD mode, passwords should not be used by the application.
IF OBJECT_ID(N'dbo.app_users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_users (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        full_name NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(MAX) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT N'user',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- =========================================================
-- 5. Indexes
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_case_number' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_case_number ON dbo.fraud_cases(case_number);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_case_status' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_case_status ON dbo.fraud_cases(case_status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_case_type' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_case_type ON dbo.fraud_cases(case_type);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_claim_status' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_claim_status ON dbo.fraud_cases(claim_status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_case_entry_date' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_case_entry_date ON dbo.fraud_cases(case_entry_date);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_fraud_cases_created_by' AND object_id = OBJECT_ID(N'dbo.fraud_cases'))
    CREATE INDEX idx_fraud_cases_created_by ON dbo.fraud_cases(created_by);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_case_documents_fraud_case_id' AND object_id = OBJECT_ID(N'dbo.case_documents'))
    CREATE INDEX idx_case_documents_fraud_case_id ON dbo.case_documents(fraud_case_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_case_action_logs_fraud_case_id' AND object_id = OBJECT_ID(N'dbo.case_action_logs'))
    CREATE INDEX idx_case_action_logs_fraud_case_id ON dbo.case_action_logs(fraud_case_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_app_users_email' AND object_id = OBJECT_ID(N'dbo.app_users'))
    CREATE INDEX idx_app_users_email ON dbo.app_users(email);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_app_users_is_active' AND object_id = OBJECT_ID(N'dbo.app_users'))
    CREATE INDEX idx_app_users_is_active ON dbo.app_users(is_active);
GO
