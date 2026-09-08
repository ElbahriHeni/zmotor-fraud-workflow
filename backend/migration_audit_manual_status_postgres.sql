-- Run once against the Fraud Management PostgreSQL database.

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
