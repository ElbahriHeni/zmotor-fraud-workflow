-- SQL Server minimum verification script
USE FraudManagementDB;
GO

SELECT 'fraud_cases' AS table_name, COUNT(*) AS total_rows FROM dbo.fraud_cases
UNION ALL
SELECT 'case_documents', COUNT(*) FROM dbo.case_documents
UNION ALL
SELECT 'case_action_logs', COUNT(*) FROM dbo.case_action_logs
UNION ALL
SELECT 'app_users', COUNT(*) FROM dbo.app_users;
GO

SELECT id, full_name, email, role, is_active, created_at
FROM dbo.app_users
ORDER BY id;
GO
