const dbType = (process.env.DB_TYPE || 'postgres').trim().toLowerCase();

function isMssql() {
  return dbType === 'mssql';
}

function dayDiff(fromValue, toValue) {
  if (!fromValue) return null;
  const from = new Date(fromValue);
  const to = toValue ? new Date(toValue) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function enrichCase(row) {
  if (!row) return null;
  return {
    ...row,
    reception_comment_days:
      row.received_date && row.comment_date ? dayDiff(row.received_date, row.comment_date) : null,
    first_escalation_days: row.first_escalation_at
      ? dayDiff(row.first_escalation_at, row.second_escalation_at || row.closed_at || null)
      : null,
    second_escalation_days: row.second_escalation_at
      ? dayDiff(row.second_escalation_at, row.closed_at || null)
      : null,
  };
}

async function ensureMotorFraudSchemaDb(pool) {
  if (isMssql()) {
    const { getPool } = require('./db-mssql');
    const db = await getPool();
    await db.request().query(`
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
          status NVARCHAR(60) NOT NULL CONSTRAINT DF_motor_fraud_status DEFAULT N'Draft',
          current_team NVARCHAR(30) NOT NULL CONSTRAINT DF_motor_fraud_team DEFAULT N'MOTOR',
          return_to_team NVARCHAR(30) NULL,
          created_by NVARCHAR(255) NOT NULL,
          created_by_name NVARCHAR(255) NULL,
          updated_by NVARCHAR(255) NULL,
          created_at DATETIME2 NOT NULL CONSTRAINT DF_motor_fraud_created_at DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 NOT NULL CONSTRAINT DF_motor_fraud_updated_at DEFAULT SYSUTCDATETIME(),
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
          uploaded_at DATETIME2 NOT NULL CONSTRAINT DF_motor_fraud_documents_uploaded_at DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_motor_fraud_documents_case FOREIGN KEY (motor_fraud_case_id)
            REFERENCES dbo.motor_fraud_cases(id) ON DELETE CASCADE
        );
        CREATE INDEX IX_motor_fraud_documents_case ON dbo.motor_fraud_documents(motor_fraud_case_id);
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
          created_at DATETIME2 NOT NULL CONSTRAINT DF_motor_fraud_history_created_at DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_motor_fraud_history_case FOREIGN KEY (motor_fraud_case_id)
            REFERENCES dbo.motor_fraud_cases(id) ON DELETE CASCADE
        );
        CREATE INDEX IX_motor_fraud_history_case ON dbo.motor_fraud_history(motor_fraud_case_id, created_at DESC);
      END;
    `);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS motor_fraud_cases (
      id SERIAL PRIMARY KEY,
      case_number VARCHAR(80) NOT NULL UNIQUE,
      claim_number VARCHAR(120) NOT NULL,
      reserve_amount NUMERIC(18,2),
      accident_number VARCHAR(120),
      claim_type VARCHAR(180),
      indicator_classification VARCHAR(50),
      sub_indicator TEXT,
      main_indicator VARCHAR(255),
      indicator_source VARCHAR(255),
      action_taken TEXT,
      received_date DATE,
      comment_date DATE,
      administrative_entity VARCHAR(255),
      employee_name VARCHAR(255),
      objection_received_date DATE,
      first_escalation_at TIMESTAMP,
      second_escalation_at TIMESTAMP,
      status VARCHAR(60) NOT NULL DEFAULT 'Draft',
      current_team VARCHAR(30) NOT NULL DEFAULT 'MOTOR',
      return_to_team VARCHAR(30),
      created_by VARCHAR(255) NOT NULL,
      created_by_name VARCHAR(255),
      updated_by VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP,
      closed_by VARCHAR(255),
      closure_outcome VARCHAR(80)
    );
    CREATE INDEX IF NOT EXISTS ix_motor_fraud_claim_number ON motor_fraud_cases(claim_number);
    CREATE INDEX IF NOT EXISTS ix_motor_fraud_status ON motor_fraud_cases(status, current_team);
    CREATE INDEX IF NOT EXISTS ix_motor_fraud_created_by ON motor_fraud_cases(created_by);

    CREATE TABLE IF NOT EXISTS motor_fraud_documents (
      id SERIAL PRIMARY KEY,
      motor_fraud_case_id INTEGER NOT NULL REFERENCES motor_fraud_cases(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(150),
      file_size INTEGER,
      file_data BYTEA NOT NULL,
      category VARCHAR(100),
      uploaded_by VARCHAR(255),
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_motor_fraud_documents_case ON motor_fraud_documents(motor_fraud_case_id);

    CREATE TABLE IF NOT EXISTS motor_fraud_history (
      id SERIAL PRIMARY KEY,
      motor_fraud_case_id INTEGER NOT NULL REFERENCES motor_fraud_cases(id) ON DELETE CASCADE,
      action_code VARCHAR(80) NOT NULL,
      from_status VARCHAR(60),
      to_status VARCHAR(60),
      from_team VARCHAR(30),
      to_team VARCHAR(30),
      actor_email VARCHAR(255),
      actor_name VARCHAR(255),
      actor_team VARCHAR(30),
      public_message TEXT,
      internal_comment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ix_motor_fraud_history_case ON motor_fraud_history(motor_fraud_case_id, created_at DESC);
  `);
}

async function createMotorFraudCaseDb(pool, body, actor) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request()
      .input('caseNumber', sql.NVarChar(80), body.case_number)
      .input('claimNumber', sql.NVarChar(120), body.claim_number)
      .input('reserveAmount', sql.Decimal(18, 2), body.reserve_amount ?? null)
      .input('accidentNumber', sql.NVarChar(120), body.accident_number || null)
      .input('claimType', sql.NVarChar(180), body.claim_type || null)
      .input('classification', sql.NVarChar(50), body.indicator_classification || null)
      .input('subIndicator', sql.NVarChar(sql.MAX), body.sub_indicator || null)
      .input('mainIndicator', sql.NVarChar(255), body.main_indicator || null)
      .input('indicatorSource', sql.NVarChar(255), body.indicator_source || null)
      .input('actionTaken', sql.NVarChar(sql.MAX), body.action_taken || null)
      .input('receivedDate', sql.Date, body.received_date || null)
      .input('commentDate', sql.Date, body.comment_date || null)
      .input('administrativeEntity', sql.NVarChar(255), body.administrative_entity || null)
      .input('employeeName', sql.NVarChar(255), body.employee_name || null)
      .input('objectionReceivedDate', sql.Date, body.objection_received_date || null)
      .input('actorEmail', sql.NVarChar(255), actor.email)
      .input('actorName', sql.NVarChar(255), actor.name || null)
      .query(`
        INSERT INTO dbo.motor_fraud_cases (
          case_number, claim_number, reserve_amount, accident_number, claim_type,
          indicator_classification, sub_indicator, main_indicator, indicator_source,
          action_taken, received_date, comment_date, administrative_entity, employee_name,
          objection_received_date, status, current_team, created_by, created_by_name, updated_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @caseNumber, @claimNumber, @reserveAmount, @accidentNumber, @claimType,
          @classification, @subIndicator, @mainIndicator, @indicatorSource,
          @actionTaken, @receivedDate, @commentDate, @administrativeEntity, @employeeName,
          @objectionReceivedDate, N'Draft', N'MOTOR', @actorEmail, @actorName, @actorEmail
        )
      `);
    return enrichCase(result.recordset[0]);
  }

  const result = await pool.query(`
    INSERT INTO motor_fraud_cases (
      case_number, claim_number, reserve_amount, accident_number, claim_type,
      indicator_classification, sub_indicator, main_indicator, indicator_source,
      action_taken, received_date, comment_date, administrative_entity, employee_name,
      objection_received_date, status, current_team, created_by, created_by_name, updated_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Draft','MOTOR',$16,$17,$16
    ) RETURNING *
  `, [
    body.case_number, body.claim_number, body.reserve_amount ?? null, body.accident_number || null,
    body.claim_type || null, body.indicator_classification, body.sub_indicator, body.main_indicator,
    body.indicator_source, body.action_taken || null, body.received_date || null, body.comment_date || null,
    body.administrative_entity || null, body.employee_name || null, body.objection_received_date || null,
    actor.email, actor.name || null,
  ]);
  return enrichCase(result.rows[0]);
}

async function updateMotorFraudCaseDb(pool, id, body, actorEmail) {
  const fields = [
    'claim_number', 'reserve_amount', 'accident_number', 'claim_type', 'indicator_classification',
    'sub_indicator', 'main_indicator', 'indicator_source', 'action_taken', 'received_date', 'comment_date',
    'administrative_entity', 'employee_name', 'objection_received_date',
  ];
  const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!updates.length) return getMotorFraudCaseDb(pool, id);

  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const request = db.request().input('id', sql.Int, Number(id)).input('actor', sql.NVarChar(255), actorEmail || null);
    const typeMap = {
      claim_number: sql.NVarChar(120), reserve_amount: sql.Decimal(18,2), accident_number: sql.NVarChar(120),
      claim_type: sql.NVarChar(180), indicator_classification: sql.NVarChar(50), sub_indicator: sql.NVarChar(sql.MAX),
      main_indicator: sql.NVarChar(255), indicator_source: sql.NVarChar(255), action_taken: sql.NVarChar(sql.MAX),
      received_date: sql.Date, comment_date: sql.Date, administrative_entity: sql.NVarChar(255),
      employee_name: sql.NVarChar(255), objection_received_date: sql.Date,
    };
    const setParts = updates.map((field, index) => {
      const param = `value${index}`;
      request.input(param, typeMap[field], body[field] === '' ? null : body[field]);
      return `${field} = @${param}`;
    });
    const result = await request.query(`
      UPDATE dbo.motor_fraud_cases
      SET ${setParts.join(', ')}, updated_by=@actor, updated_at=SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id=@id
    `);
    return enrichCase(result.recordset[0] || null);
  }

  const values = updates.map((field) => body[field] === '' ? null : body[field]);
  values.push(actorEmail || null, Number(id));
  const setParts = updates.map((field, index) => `${field}=$${index + 1}`);
  const result = await pool.query(`
    UPDATE motor_fraud_cases
    SET ${setParts.join(', ')}, updated_by=$${updates.length + 1}, updated_at=CURRENT_TIMESTAMP
    WHERE id=$${updates.length + 2}
    RETURNING *
  `, values);
  return enrichCase(result.rows[0] || null);
}

async function getMotorFraudCaseDb(pool, id) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request().input('idText', sql.NVarChar(120), String(id)).query(`
      SELECT TOP 1 * FROM dbo.motor_fraud_cases
      WHERE CAST(id AS NVARCHAR(120))=@idText OR case_number=@idText
    `);
    return enrichCase(result.recordset[0] || null);
  }
  const result = await pool.query(`
    SELECT * FROM motor_fraud_cases
    WHERE id::text=$1 OR case_number=$1
    LIMIT 1
  `, [String(id)]);
  return enrichCase(result.rows[0] || null);
}

async function listMotorFraudCasesDb(pool, actorEmail, canViewAll) {
  let rows;
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const request = db.request().input('actor', sql.NVarChar(255), actorEmail || '');
    const result = await request.query(`
      SELECT id, case_number, claim_number, reserve_amount, accident_number, claim_type,
             indicator_classification, sub_indicator, main_indicator, indicator_source,
             action_taken, received_date, comment_date, administrative_entity, employee_name,
             objection_received_date, first_escalation_at, second_escalation_at,
             status, current_team, return_to_team, created_by, created_by_name,
             created_at, updated_at, closed_at, closure_outcome
      FROM dbo.motor_fraud_cases
      ${canViewAll ? '' : 'WHERE LOWER(created_by)=LOWER(@actor)'}
      ORDER BY created_at DESC
    `);
    rows = result.recordset;
  } else {
    const result = await pool.query(`
      SELECT id, case_number, claim_number, reserve_amount, accident_number, claim_type,
             indicator_classification, sub_indicator, main_indicator, indicator_source,
             action_taken, received_date, comment_date, administrative_entity, employee_name,
             objection_received_date, first_escalation_at, second_escalation_at,
             status, current_team, return_to_team, created_by, created_by_name,
             created_at, updated_at, closed_at, closure_outcome
      FROM motor_fraud_cases
      ${canViewAll ? '' : 'WHERE LOWER(created_by)=LOWER($1)'}
      ORDER BY created_at DESC
    `, canViewAll ? [] : [actorEmail || '']);
    rows = result.rows;
  }
  return rows.map(enrichCase);
}

async function addMotorFraudHistoryDb(pool, caseId, entry) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request()
      .input('caseId', sql.Int, Number(caseId))
      .input('actionCode', sql.NVarChar(80), entry.action_code)
      .input('fromStatus', sql.NVarChar(60), entry.from_status || null)
      .input('toStatus', sql.NVarChar(60), entry.to_status || null)
      .input('fromTeam', sql.NVarChar(30), entry.from_team || null)
      .input('toTeam', sql.NVarChar(30), entry.to_team || null)
      .input('actorEmail', sql.NVarChar(255), entry.actor_email || null)
      .input('actorName', sql.NVarChar(255), entry.actor_name || null)
      .input('actorTeam', sql.NVarChar(30), entry.actor_team || null)
      .input('publicMessage', sql.NVarChar(sql.MAX), entry.public_message || null)
      .input('internalComment', sql.NVarChar(sql.MAX), entry.internal_comment || null)
      .query(`
        INSERT INTO dbo.motor_fraud_history (
          motor_fraud_case_id, action_code, from_status, to_status, from_team, to_team,
          actor_email, actor_name, actor_team, public_message, internal_comment
        ) OUTPUT INSERTED.*
        VALUES (@caseId,@actionCode,@fromStatus,@toStatus,@fromTeam,@toTeam,
                @actorEmail,@actorName,@actorTeam,@publicMessage,@internalComment)
      `);
    return result.recordset[0];
  }
  const result = await pool.query(`
    INSERT INTO motor_fraud_history (
      motor_fraud_case_id, action_code, from_status, to_status, from_team, to_team,
      actor_email, actor_name, actor_team, public_message, internal_comment
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
  `, [caseId, entry.action_code, entry.from_status || null, entry.to_status || null,
      entry.from_team || null, entry.to_team || null, entry.actor_email || null, entry.actor_name || null,
      entry.actor_team || null, entry.public_message || null, entry.internal_comment || null]);
  return result.rows[0];
}

async function getMotorFraudHistoryDb(pool, caseId) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request().input('caseId', sql.Int, Number(caseId)).query(`
      SELECT * FROM dbo.motor_fraud_history WHERE motor_fraud_case_id=@caseId ORDER BY created_at ASC, id ASC
    `);
    return result.recordset;
  }
  const result = await pool.query(`
    SELECT * FROM motor_fraud_history WHERE motor_fraud_case_id=$1 ORDER BY created_at ASC, id ASC
  `, [caseId]);
  return result.rows;
}

async function addMotorFraudDocumentDb(pool, caseId, file, uploadedBy) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request()
      .input('caseId', sql.Int, Number(caseId))
      .input('fileName', sql.NVarChar(255), file.file_name)
      .input('fileType', sql.NVarChar(150), file.file_type || 'application/octet-stream')
      .input('fileSize', sql.Int, Number(file.file_size || 0))
      .input('fileData', sql.VarBinary(sql.MAX), file.file_data)
      .input('category', sql.NVarChar(100), file.category || 'supporting_document')
      .input('uploadedBy', sql.NVarChar(255), uploadedBy || null)
      .query(`
        INSERT INTO dbo.motor_fraud_documents (
          motor_fraud_case_id,file_name,file_type,file_size,file_data,category,uploaded_by
        ) OUTPUT INSERTED.id,INSERTED.motor_fraud_case_id,INSERTED.file_name,INSERTED.file_type,
                 INSERTED.file_size,INSERTED.category,INSERTED.uploaded_by,INSERTED.uploaded_at
        VALUES (@caseId,@fileName,@fileType,@fileSize,@fileData,@category,@uploadedBy)
      `);
    return result.recordset[0];
  }
  const result = await pool.query(`
    INSERT INTO motor_fraud_documents (
      motor_fraud_case_id,file_name,file_type,file_size,file_data,category,uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id,motor_fraud_case_id,file_name,file_type,file_size,category,uploaded_by,uploaded_at
  `, [caseId, file.file_name, file.file_type || 'application/octet-stream', Number(file.file_size || 0),
      file.file_data, file.category || 'supporting_document', uploadedBy || null]);
  return result.rows[0];
}

async function getMotorFraudDocumentsDb(pool, caseId) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request().input('caseId', sql.Int, Number(caseId)).query(`
      SELECT id,motor_fraud_case_id,file_name,file_type,file_size,category,uploaded_by,uploaded_at
      FROM dbo.motor_fraud_documents WHERE motor_fraud_case_id=@caseId ORDER BY uploaded_at DESC, id DESC
    `);
    return result.recordset;
  }
  const result = await pool.query(`
    SELECT id,motor_fraud_case_id,file_name,file_type,file_size,category,uploaded_by,uploaded_at
    FROM motor_fraud_documents WHERE motor_fraud_case_id=$1 ORDER BY uploaded_at DESC, id DESC
  `, [caseId]);
  return result.rows;
}

async function getMotorFraudDocumentDb(pool, documentId) {
  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request().input('id', sql.Int, Number(documentId)).query(`
      SELECT TOP 1 * FROM dbo.motor_fraud_documents WHERE id=@id
    `);
    return result.recordset[0] || null;
  }
  const result = await pool.query(`SELECT * FROM motor_fraud_documents WHERE id=$1 LIMIT 1`, [documentId]);
  return result.rows[0] || null;
}

async function transitionMotorFraudCaseDb(pool, id, transition) {
  const nowFirst = Boolean(transition.set_first_escalation);
  const nowSecond = Boolean(transition.set_second_escalation);
  const closeNow = Boolean(transition.close_now);

  if (isMssql()) {
    const { sql, getPool } = require('./db-mssql');
    const db = await getPool();
    const result = await db.request()
      .input('id', sql.Int, Number(id))
      .input('status', sql.NVarChar(60), transition.status)
      .input('currentTeam', sql.NVarChar(30), transition.current_team)
      .input('returnToTeam', sql.NVarChar(30), transition.return_to_team || null)
      .input('actor', sql.NVarChar(255), transition.actor_email || null)
      .input('closureOutcome', sql.NVarChar(80), transition.closure_outcome || null)
      .query(`
        UPDATE dbo.motor_fraud_cases
        SET status=@status,
            current_team=@currentTeam,
            return_to_team=@returnToTeam,
            updated_by=@actor,
            updated_at=SYSUTCDATETIME(),
            first_escalation_at=${nowFirst ? 'COALESCE(first_escalation_at,SYSUTCDATETIME())' : 'first_escalation_at'},
            second_escalation_at=${nowSecond ? 'COALESCE(second_escalation_at,SYSUTCDATETIME())' : 'second_escalation_at'},
            closed_at=${closeNow ? 'COALESCE(closed_at,SYSUTCDATETIME())' : 'closed_at'},
            closed_by=${closeNow ? '@actor' : 'closed_by'},
            closure_outcome=${closeNow ? '@closureOutcome' : 'closure_outcome'}
        OUTPUT INSERTED.*
        WHERE id=@id
      `);
    return enrichCase(result.recordset[0] || null);
  }

  const result = await pool.query(`
    UPDATE motor_fraud_cases
    SET status=$2,
        current_team=$3,
        return_to_team=$4,
        updated_by=$5,
        updated_at=CURRENT_TIMESTAMP,
        first_escalation_at=${nowFirst ? 'COALESCE(first_escalation_at,CURRENT_TIMESTAMP)' : 'first_escalation_at'},
        second_escalation_at=${nowSecond ? 'COALESCE(second_escalation_at,CURRENT_TIMESTAMP)' : 'second_escalation_at'},
        closed_at=${closeNow ? 'COALESCE(closed_at,CURRENT_TIMESTAMP)' : 'closed_at'},
        closed_by=${closeNow ? '$5' : 'closed_by'},
        closure_outcome=${closeNow ? '$6' : 'closure_outcome'}
    WHERE id=$1
    RETURNING *
  `, [Number(id), transition.status, transition.current_team, transition.return_to_team || null,
      transition.actor_email || null, transition.closure_outcome || null]);
  return enrichCase(result.rows[0] || null);
}

module.exports = {
  ensureMotorFraudSchemaDb,
  createMotorFraudCaseDb,
  updateMotorFraudCaseDb,
  getMotorFraudCaseDb,
  listMotorFraudCasesDb,
  addMotorFraudHistoryDb,
  getMotorFraudHistoryDb,
  addMotorFraudDocumentDb,
  getMotorFraudDocumentsDb,
  getMotorFraudDocumentDb,
  transitionMotorFraudCaseDb,
  dayDiff,
};
