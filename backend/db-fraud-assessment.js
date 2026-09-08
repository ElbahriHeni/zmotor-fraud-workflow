const { getFraudAssessmentDefinition } = require('./fraud-assessment-config');

const dbType = (process.env.DB_TYPE || 'postgres').trim().toLowerCase();

function isMssql() {
  return dbType === 'mssql';
}

function requireAssessmentDefinition(assessmentCode) {
  const definition = getFraudAssessmentDefinition(assessmentCode);
  if (!definition) {
    const error = new Error(`Unknown fraud assessment code '${assessmentCode}'.`);
    error.statusCode = 404;
    throw error;
  }
  return definition;
}

function serializeAnswer(value) {
  if (value === undefined || value === null) return JSON.stringify('');
  return JSON.stringify(value);
}

function deserializeAnswer(value) {
  if (value === undefined || value === null || value === '') return '';
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function ensureFraudAssessmentSchemaDb(pool) {
  if (isMssql()) {
    const { getPool } = require('./db-mssql');
    const db = await getPool();

    await db.request().query(`
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
    `);

    return;
  }

  await pool.query(`
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
  `);
}

async function getFraudAssessmentDb(pool, assessmentCode) {
  const definition = requireAssessmentDefinition(assessmentCode);
  let assessment;
  let rows;

  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const assessmentResult = await db
      .request()
      .input('assessmentCode', sql.NVarChar(20), definition.code)
      .query(`
        SELECT id, assessment_code, assessment_name, status, created_by, updated_by, submitted_by,
               created_at, updated_at, submitted_at
        FROM dbo.fraud_assessments
        WHERE assessment_code = @assessmentCode
      `);

    assessment = assessmentResult.recordset[0] || null;
    if (!assessment) {
      return {
        assessment_code: definition.code,
        assessment_name: definition.name,
        status: 'Draft',
        created_by: null,
        updated_by: null,
        submitted_by: null,
        created_at: null,
        updated_at: null,
        submitted_at: null,
        answers: [],
      };
    }

    const answersResult = await db
      .request()
      .input('assessmentId', sql.Int, assessment.id)
      .query(`
        SELECT question_code, answer_text, comments, other_text, updated_by, updated_at
        FROM dbo.fraud_assessment_answers
        WHERE assessment_id = @assessmentId
        ORDER BY question_code
      `);
    rows = answersResult.recordset;
  } else {
    const assessmentResult = await pool.query(
      `
      SELECT id, assessment_code, assessment_name, status, created_by, updated_by, submitted_by,
             created_at, updated_at, submitted_at
      FROM fraud_assessments
      WHERE assessment_code = $1
      `,
      [definition.code]
    );

    assessment = assessmentResult.rows[0] || null;
    if (!assessment) {
      return {
        assessment_code: definition.code,
        assessment_name: definition.name,
        status: 'Draft',
        created_by: null,
        updated_by: null,
        submitted_by: null,
        created_at: null,
        updated_at: null,
        submitted_at: null,
        answers: [],
      };
    }

    const answersResult = await pool.query(
      `
      SELECT question_code, answer_text, comments, other_text, updated_by, updated_at
      FROM fraud_assessment_answers
      WHERE assessment_id = $1
      ORDER BY question_code
      `,
      [assessment.id]
    );
    rows = answersResult.rows;
  }

  return {
    ...assessment,
    answers: rows.map((row) => ({
      question_code: row.question_code,
      answer: deserializeAnswer(row.answer_text),
      comments: row.comments || '',
      other_text: row.other_text || '',
      updated_by: row.updated_by || null,
      updated_at: row.updated_at || null,
    })),
  };
}

async function saveFraudAssessmentDb(pool, assessmentCode, answers, actorEmail) {
  const definition = requireAssessmentDefinition(assessmentCode);

  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const transaction = new sql.Transaction(db);
    await transaction.begin();

    try {
      const upsertAssessment = await new sql.Request(transaction)
        .input('assessmentCode', sql.NVarChar(20), definition.code)
        .input('assessmentName', sql.NVarChar(255), definition.name)
        .input('actor', sql.NVarChar(255), actorEmail || null)
        .query(`
          MERGE dbo.fraud_assessments AS target
          USING (SELECT @assessmentCode AS assessment_code) AS source
          ON target.assessment_code = source.assessment_code
          WHEN MATCHED THEN UPDATE SET
            assessment_name = @assessmentName,
            updated_by = @actor,
            updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (assessment_code, assessment_name, status, created_by, updated_by)
            VALUES (@assessmentCode, @assessmentName, N'Draft', @actor, @actor)
          OUTPUT INSERTED.id;
        `);

      const assessmentId = upsertAssessment.recordset[0].id;

      for (const answer of answers) {
        await new sql.Request(transaction)
          .input('assessmentId', sql.Int, assessmentId)
          .input('questionCode', sql.NVarChar(20), answer.question_code)
          .input('answerText', sql.NVarChar(sql.MAX), serializeAnswer(answer.answer))
          .input('comments', sql.NVarChar(sql.MAX), answer.comments || null)
          .input('otherText', sql.NVarChar(1000), answer.other_text || null)
          .input('actor', sql.NVarChar(255), actorEmail || null)
          .query(`
            MERGE dbo.fraud_assessment_answers AS target
            USING (SELECT @assessmentId AS assessment_id, @questionCode AS question_code) AS source
            ON target.assessment_id = source.assessment_id AND target.question_code = source.question_code
            WHEN MATCHED THEN UPDATE SET
              answer_text = @answerText,
              comments = @comments,
              other_text = @otherText,
              updated_by = @actor,
              updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
              INSERT (assessment_id, question_code, answer_text, comments, other_text, updated_by)
              VALUES (@assessmentId, @questionCode, @answerText, @comments, @otherText, @actor);
          `);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const assessmentResult = await client.query(
        `
        INSERT INTO fraud_assessments (assessment_code, assessment_name, status, created_by, updated_by)
        VALUES ($1, $2, 'Draft', $3, $3)
        ON CONFLICT (assessment_code) DO UPDATE SET
          assessment_name = EXCLUDED.assessment_name,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
        `,
        [definition.code, definition.name, actorEmail || null]
      );
      const assessmentId = assessmentResult.rows[0].id;

      for (const answer of answers) {
        await client.query(
          `
          INSERT INTO fraud_assessment_answers
            (assessment_id, question_code, answer_text, comments, other_text, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (assessment_id, question_code) DO UPDATE SET
            answer_text = EXCLUDED.answer_text,
            comments = EXCLUDED.comments,
            other_text = EXCLUDED.other_text,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP
          `,
          [assessmentId, answer.question_code, serializeAnswer(answer.answer), answer.comments || null, answer.other_text || null, actorEmail || null]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return getFraudAssessmentDb(pool, definition.code);
}

async function submitFraudAssessmentDb(pool, assessmentCode, answers, actorEmail) {
  const definition = requireAssessmentDefinition(assessmentCode);
  await saveFraudAssessmentDb(pool, definition.code, answers, actorEmail);

  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    await db
      .request()
      .input('assessmentCode', sql.NVarChar(20), definition.code)
      .input('actor', sql.NVarChar(255), actorEmail || null)
      .query(`
        UPDATE dbo.fraud_assessments
        SET status = N'Submitted', submitted_by = @actor, submitted_at = SYSUTCDATETIME(),
            updated_by = @actor, updated_at = SYSUTCDATETIME()
        WHERE assessment_code = @assessmentCode
      `);
  } else {
    await pool.query(
      `
      UPDATE fraud_assessments
      SET status = 'Submitted', submitted_by = $2, submitted_at = CURRENT_TIMESTAMP,
          updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE assessment_code = $1
      `,
      [definition.code, actorEmail || null]
    );
  }

  return getFraudAssessmentDb(pool, definition.code);
}

module.exports = {
  ensureFraudAssessmentSchemaDb,
  getFraudAssessmentDb,
  saveFraudAssessmentDb,
  submitFraudAssessmentDb,
};
