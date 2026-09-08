-- Fraud Management RBAC migration for PostgreSQL
-- Safe to run repeatedly. Back up the database before production deployment.
BEGIN;

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
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_allowed BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, permission_id)
);

INSERT INTO permissions(permission_code, permission_name, module_name, description)
VALUES
  ('dashboard.view','View Dashboard','Dashboard','Open the operational dashboard.'),
  ('cases.view','View Cases','Cases','View fraud cases and case history.'),
  ('cases.create','Create Cases','Cases','Create and save fraud cases.'),
  ('cases.update','Update Cases','Cases','Edit fraud case information.'),
  ('cases.change_status','Change Case Status','Cases','Open, suspend, or close fraud cases.'),
  ('cases.assign','Assign Cases','Cases','Assign, reassign, or release cases.'),
  ('cases.upload_documents','Upload Documents','Cases','Upload or register case documents.'),
  ('cases.download_documents','Download Documents','Cases','View and download case documents.'),
  ('cases.export_pdf','Export Case PDF','Cases','Export a fraud case as PDF.'),
  ('reports.view','View Reports','Reports','Open fraud reports.'),
  ('reports.export','Export Reports','Reports','Export filtered report results.'),
  ('users.view','View Users','User Management','View application users.'),
  ('users.create','Create Users','User Management','Create application users.'),
  ('users.update','Update Users','User Management','Edit application users and roles.'),
  ('users.activate','Activate or Deactivate Users','User Management','Control whether users can sign in.'),
  ('users.reset_password','Reset Passwords','User Management','Reset local user passwords.'),
  ('users.manage_permissions','Manage User Permissions','User Management','Grant or deny user-level permission overrides.'),
  ('roles.view','View Roles','Role Management','View roles and their permissions.'),
  ('roles.create','Create Roles','Role Management','Create configurable application roles.'),
  ('roles.update','Update Roles','Role Management','Edit role details and activation status.'),
  ('roles.manage_permissions','Manage Role Permissions','Role Management','Configure permissions assigned to roles.'),
  ('audit.view','View Audit Log','Audit & Compliance','Review security and business activity.'),
  ('assistant.use','Use Intelligent Assistant','Intelligent Assistant','Open the read-only in-application assistant.'),
  ('assistant.view_case_status','Assistant Case Status Lookup','Intelligent Assistant','Ask the assistant for the current status of authorized cases.'),
  ('assistant.summarize_cases','Assistant Case Summaries','Intelligent Assistant','Ask the assistant to summarize authorized cases without personal reporter data.'),
  ('assistant.view_assigned_cases','Assistant Assigned Cases','Intelligent Assistant','Ask the assistant to list cases assigned to the signed-in user.'),
  ('assistant.view_operational_statistics','Assistant Operational Statistics','Intelligent Assistant','Ask the assistant for authorized case status counts.')
ON CONFLICT(permission_code) DO UPDATE SET
  permission_name=EXCLUDED.permission_name,
  module_name=EXCLUDED.module_name,
  description=EXCLUDED.description;

INSERT INTO roles(role_code, role_name, description, is_system, is_active)
VALUES
  ('SYSTEM_ADMIN','System Administrator','Full application and security administration access.',true,true),
  ('FRAUD_MANAGER','Fraud Manager','Manages fraud operations, assignments, statuses, and reports.',true,true),
  ('FRAUD_INVESTIGATOR','Fraud Investigator','Creates and investigates cases and maintains supporting evidence.',true,true),
  ('AUDITOR','Auditor / Read Only','Read-only access to cases, reports, documents, and audit evidence.',true,true)
ON CONFLICT(role_code) DO UPDATE SET
  role_name=EXCLUDED.role_name,
  description=EXCLUDED.description,
  is_system=EXCLUDED.is_system,
  is_active=true,
  updated_at=CURRENT_TIMESTAMP;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('SYSTEM_ADMIN','dashboard.view'),
  ('SYSTEM_ADMIN','cases.view'),
  ('SYSTEM_ADMIN','cases.create'),
  ('SYSTEM_ADMIN','cases.update'),
  ('SYSTEM_ADMIN','cases.change_status'),
  ('SYSTEM_ADMIN','cases.assign'),
  ('SYSTEM_ADMIN','cases.upload_documents'),
  ('SYSTEM_ADMIN','cases.download_documents'),
  ('SYSTEM_ADMIN','cases.export_pdf'),
  ('SYSTEM_ADMIN','reports.view'),
  ('SYSTEM_ADMIN','reports.export'),
  ('SYSTEM_ADMIN','users.view'),
  ('SYSTEM_ADMIN','users.create'),
  ('SYSTEM_ADMIN','users.update'),
  ('SYSTEM_ADMIN','users.activate'),
  ('SYSTEM_ADMIN','users.reset_password'),
  ('SYSTEM_ADMIN','users.manage_permissions'),
  ('SYSTEM_ADMIN','roles.view'),
  ('SYSTEM_ADMIN','roles.create'),
  ('SYSTEM_ADMIN','roles.update'),
  ('SYSTEM_ADMIN','roles.manage_permissions'),
  ('SYSTEM_ADMIN','audit.view'),
  ('SYSTEM_ADMIN','assistant.use'),
  ('SYSTEM_ADMIN','assistant.view_case_status'),
  ('SYSTEM_ADMIN','assistant.summarize_cases'),
  ('SYSTEM_ADMIN','assistant.view_assigned_cases'),
  ('SYSTEM_ADMIN','assistant.view_operational_statistics'),
  ('FRAUD_MANAGER','dashboard.view'),
  ('FRAUD_MANAGER','cases.view'),
  ('FRAUD_MANAGER','cases.create'),
  ('FRAUD_MANAGER','cases.update'),
  ('FRAUD_MANAGER','cases.change_status'),
  ('FRAUD_MANAGER','cases.assign'),
  ('FRAUD_MANAGER','cases.upload_documents'),
  ('FRAUD_MANAGER','cases.download_documents'),
  ('FRAUD_MANAGER','cases.export_pdf'),
  ('FRAUD_MANAGER','reports.view'),
  ('FRAUD_MANAGER','reports.export'),
  ('FRAUD_MANAGER','users.view'),
  ('FRAUD_MANAGER','assistant.use'),
  ('FRAUD_MANAGER','assistant.view_case_status'),
  ('FRAUD_MANAGER','assistant.summarize_cases'),
  ('FRAUD_MANAGER','assistant.view_assigned_cases'),
  ('FRAUD_MANAGER','assistant.view_operational_statistics'),
  ('FRAUD_INVESTIGATOR','dashboard.view'),
  ('FRAUD_INVESTIGATOR','cases.view'),
  ('FRAUD_INVESTIGATOR','cases.create'),
  ('FRAUD_INVESTIGATOR','cases.update'),
  ('FRAUD_INVESTIGATOR','cases.change_status'),
  ('FRAUD_INVESTIGATOR','cases.upload_documents'),
  ('FRAUD_INVESTIGATOR','cases.download_documents'),
  ('FRAUD_INVESTIGATOR','cases.export_pdf'),
  ('FRAUD_INVESTIGATOR','reports.view'),
  ('FRAUD_INVESTIGATOR','assistant.use'),
  ('FRAUD_INVESTIGATOR','assistant.view_case_status'),
  ('FRAUD_INVESTIGATOR','assistant.summarize_cases'),
  ('FRAUD_INVESTIGATOR','assistant.view_assigned_cases'),
  ('FRAUD_INVESTIGATOR','assistant.view_operational_statistics'),
  ('AUDITOR','dashboard.view'),
  ('AUDITOR','cases.view'),
  ('AUDITOR','cases.download_documents'),
  ('AUDITOR','cases.export_pdf'),
  ('AUDITOR','reports.view'),
  ('AUDITOR','reports.export'),
  ('AUDITOR','audit.view'),
  ('AUDITOR','assistant.use'),
  ('AUDITOR','assistant.view_case_status'),
  ('AUDITOR','assistant.summarize_cases'),
  ('AUDITOR','assistant.view_operational_statistics')
) AS source(role_code, permission_code)
JOIN roles r ON r.role_code=source.role_code
JOIN permissions p ON p.permission_code=source.permission_code
ON CONFLICT(role_id, permission_id) DO NOTHING;

UPDATE app_users SET username=split_part(email,'@',1)
WHERE username IS NULL OR btrim(username)='';

UPDATE app_users u
SET role_id=r.id
FROM roles r
WHERE u.role_id IS NULL
AND r.role_code=CASE
  WHEN lower(COALESCE(u.role,'')) IN ('admin','system_admin','system administrator','system_administrator') THEN 'SYSTEM_ADMIN'
  ELSE 'FRAUD_INVESTIGATOR'
END;

COMMIT;
