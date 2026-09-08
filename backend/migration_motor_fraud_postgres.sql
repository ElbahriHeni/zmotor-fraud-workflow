CREATE TABLE IF NOT EXISTS motor_fraud_cases (
  id SERIAL PRIMARY KEY,
  case_number VARCHAR(80) NOT NULL UNIQUE,
  claim_number VARCHAR(120) NOT NULL,
  reserve_amount NUMERIC(18,2), accident_number VARCHAR(120), claim_type VARCHAR(180),
  indicator_classification VARCHAR(50), sub_indicator TEXT, main_indicator VARCHAR(255), indicator_source VARCHAR(255),
  action_taken TEXT, received_date DATE, comment_date DATE, administrative_entity VARCHAR(255), employee_name VARCHAR(255),
  objection_received_date DATE, first_escalation_at TIMESTAMP, second_escalation_at TIMESTAMP,
  status VARCHAR(60) NOT NULL DEFAULT 'Draft', current_team VARCHAR(30) NOT NULL DEFAULT 'MOTOR', return_to_team VARCHAR(30),
  created_by VARCHAR(255) NOT NULL, created_by_name VARCHAR(255), updated_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP, closed_by VARCHAR(255), closure_outcome VARCHAR(80)
);
CREATE INDEX IF NOT EXISTS ix_motor_fraud_claim_number ON motor_fraud_cases(claim_number);
CREATE INDEX IF NOT EXISTS ix_motor_fraud_status ON motor_fraud_cases(status, current_team);
CREATE INDEX IF NOT EXISTS ix_motor_fraud_created_by ON motor_fraud_cases(created_by);

CREATE TABLE IF NOT EXISTS motor_fraud_documents (
  id SERIAL PRIMARY KEY,
  motor_fraud_case_id INTEGER NOT NULL REFERENCES motor_fraud_cases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL, file_type VARCHAR(150), file_size INTEGER, file_data BYTEA NOT NULL,
  category VARCHAR(100), uploaded_by VARCHAR(255), uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS motor_fraud_history (
  id SERIAL PRIMARY KEY,
  motor_fraud_case_id INTEGER NOT NULL REFERENCES motor_fraud_cases(id) ON DELETE CASCADE,
  action_code VARCHAR(80) NOT NULL, from_status VARCHAR(60), to_status VARCHAR(60), from_team VARCHAR(30), to_team VARCHAR(30),
  actor_email VARCHAR(255), actor_name VARCHAR(255), actor_team VARCHAR(30), public_message TEXT, internal_comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permissions and system roles are seeded automatically by db-rbac.js at backend startup.
