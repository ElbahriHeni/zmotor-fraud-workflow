/* Fraud Assessment 01 - Strategy & Risk Appetite */

CREATE TABLE IF NOT EXISTS fraud_assessments (
  id SERIAL PRIMARY KEY,
  assessment_code VARCHAR(20) NOT NULL UNIQUE,
  assessment_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  submitted_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_assessment_answers (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES fraud_assessments(id) ON DELETE CASCADE,
  question_code VARCHAR(20) NOT NULL,
  answer_text TEXT,
  comments TEXT,
  other_text VARCHAR(1000),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assessment_id, question_code)
);
