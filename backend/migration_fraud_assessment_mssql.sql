/* Fraud Assessment 01 - Strategy & Risk Appetite */

IF OBJECT_ID(N'dbo.fraud_assessments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fraud_assessments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    assessment_code NVARCHAR(20) NOT NULL,
    assessment_name NVARCHAR(255) NOT NULL,
    status NVARCHAR(30) NOT NULL CONSTRAINT DF_fraud_assessments_status DEFAULT N'Draft',
    created_by NVARCHAR(255) NULL,
    updated_by NVARCHAR(255) NULL,
    submitted_by NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_fraud_assessments_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_fraud_assessments_updated_at DEFAULT SYSUTCDATETIME(),
    submitted_at DATETIME2 NULL
  );
  CREATE UNIQUE INDEX UX_fraud_assessments_code ON dbo.fraud_assessments(assessment_code);
END;

IF OBJECT_ID(N'dbo.fraud_assessment_answers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fraud_assessment_answers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    assessment_id INT NOT NULL,
    question_code NVARCHAR(20) NOT NULL,
    answer_text NVARCHAR(MAX) NULL,
    comments NVARCHAR(MAX) NULL,
    other_text NVARCHAR(1000) NULL,
    updated_by NVARCHAR(255) NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_fraud_assessment_answers_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_fraud_assessment_answers_assessment
      FOREIGN KEY (assessment_id) REFERENCES dbo.fraud_assessments(id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX UX_fraud_assessment_answers_question
    ON dbo.fraud_assessment_answers(assessment_id, question_code);
END;
