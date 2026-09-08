const crypto = require('crypto');
const {
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
} = require('./db-motor-fraud');
const { findMotorFraudIndicator } = require('./motor-fraud-indicators');
const { buildMotorFraudExcel } = require('./motor-fraud-excel');

const EDITABLE_MOTOR_STATUSES = new Set([
  'Draft',
  'Returned to Motor from Legal',
  'Returned to Motor from Fraud',
]);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function nullableText(value) {
  if (value === undefined) return undefined;
  const text = String(value ?? '').trim();
  return text || null;
}

function createCaseNumber() {
  const year = new Date().getFullYear();
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.toUpperCase();
  return `MF-${year}-${suffix}`;
}

function sanitizeFileName(fileName) {
  return String(fileName || 'document')
    .replace(/[^a-zA-Z0-9._\-\u0600-\u06FF ]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
}

function motorPayload(body = {}) {
  return {
    claim_number: nullableText(body.claim_number),
    reserve_amount: body.reserve_amount === '' || body.reserve_amount === null || body.reserve_amount === undefined
      ? null
      : Number(body.reserve_amount),
    accident_number: nullableText(body.accident_number),
    claim_type: nullableText(body.claim_type),
    indicator_classification: nullableText(body.indicator_classification),
    sub_indicator: nullableText(body.sub_indicator),
    main_indicator: nullableText(body.main_indicator),
    indicator_source: nullableText(body.indicator_source),
    action_taken: nullableText(body.action_taken),
    received_date: nullableText(body.received_date),
    comment_date: nullableText(body.comment_date),
    administrative_entity: nullableText(body.administrative_entity),
    employee_name: nullableText(body.employee_name),
    objection_received_date: nullableText(body.objection_received_date),
  };
}

function validateHierarchy(payload, { complete = false } = {}) {
  const source = payload.indicator_source;
  const main = payload.main_indicator;
  const sub = payload.sub_indicator;
  const classification = payload.indicator_classification;
  const any = Boolean(source || main || sub || classification);

  if (!any && !complete) return;
  if (!source || !main || !sub || !classification) {
    const error = new Error('Select the complete Motor Fraud indicator hierarchy.');
    error.statusCode = 400;
    throw error;
  }

  const match = findMotorFraudIndicator(source, main, sub);
  if (!match || match.classification !== classification) {
    const error = new Error('The selected Motor Fraud indicator combination does not match the regulator indicator mapping.');
    error.statusCode = 400;
    throw error;
  }
}

function validateSubmission(payload) {
  const required = [
    'claim_number', 'reserve_amount', 'accident_number', 'claim_type',
    'indicator_classification', 'sub_indicator', 'main_indicator', 'indicator_source',
    'action_taken', 'received_date', 'comment_date', 'administrative_entity',
    'employee_name', 'objection_received_date',
  ];
  const missing = required.find((field) => payload[field] === null || payload[field] === undefined || payload[field] === '');
  if (missing) {
    const error = new Error('Complete all Motor team fields before submitting the case.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(Number(payload.reserve_amount)) || Number(payload.reserve_amount) < 0) {
    const error = new Error('Reserve amount must be a valid non-negative number.');
    error.statusCode = 400;
    throw error;
  }
  validateHierarchy(payload, { complete: true });
}

function registerMotorFraudRoutes(app, deps) {
  const {
    pool,
    requirePermission,
    hasPermission,
    isSystemAdministrator,
    getCurrentUser,
    getCurrentUserEmail,
    getCurrentUserName,
    upload,
    validateUploadedFile,
  } = deps;

  const isAdmin = (req) => isSystemAdministrator(getCurrentUser(req));
  const isLegalReviewer = (req) => hasPermission(getCurrentUser(req), 'motor_fraud.legal_review');
  const isFraudReviewer = (req) => hasPermission(getCurrentUser(req), 'motor_fraud.fraud_review');
  const isReviewTeam = (req) => isAdmin(req) || isLegalReviewer(req) || isFraudReviewer(req);
  const isInitiator = (req, item) => normalize(item?.created_by) === normalize(getCurrentUserEmail(req));
  const canAccess = (req, item) => Boolean(item) && (
    isAdmin(req) ||
    isInitiator(req, item) ||
    (isLegalReviewer(req) && Boolean(item.first_escalation_at)) ||
    (isFraudReviewer(req) && Boolean(item.second_escalation_at))
  );
  const motorOwnerOrAdmin = (req, item) => isAdmin(req) || isInitiator(req, item);

  // Determine whether the signed-in user may add evidence at the case's
  // current workflow stage. Documents are workflow evidence, so Motor, Legal
  // and Fraud can each add files while the case is currently with their team.
  // Closed cases remain immutable.
  function documentUploadTeam(req, item) {
    if (!item || !hasPermission(getCurrentUser(req), 'motor_fraud.upload_documents')) return null;

    if (EDITABLE_MOTOR_STATUSES.has(item.status) && motorOwnerOrAdmin(req, item)) {
      return 'MOTOR';
    }

    if (item.status === 'With Legal' && (isAdmin(req) || isLegalReviewer(req))) {
      return 'LEGAL';
    }

    if (item.status === 'With Fraud' && (isAdmin(req) || isFraudReviewer(req))) {
      return 'FRAUD';
    }

    return null;
  }

  async function requireCase(req, res) {
    const item = await getMotorFraudCaseDb(pool, req.params.id);
    if (!item) {
      res.status(404).json({ message: 'Motor Fraud case not found.' });
      return null;
    }
    if (!canAccess(req, item)) {
      res.status(403).json({ message: 'You are not allowed to access this Motor Fraud case.' });
      return null;
    }
    return item;
  }

  function filterHistory(req, rows) {
    const user = getCurrentUser(req);
    const seeLegal = isAdmin(req) || hasPermission(user, 'motor_fraud.legal_review') || hasPermission(user, 'motor_fraud.fraud_review');
    const seeFraud = isAdmin(req) || hasPermission(user, 'motor_fraud.fraud_review');
    return rows.map((entry) => {
      const canSeeInternal = entry.actor_team === 'LEGAL' ? seeLegal : entry.actor_team === 'FRAUD' ? seeFraud : false;
      return {
        ...entry,
        internal_comment: canSeeInternal ? entry.internal_comment : undefined,
      };
    });
  }

  async function buildDetails(req, item) {
    const user = getCurrentUser(req);
    const owner = isInitiator(req, item);
    const admin = isAdmin(req);
    const editable = EDITABLE_MOTOR_STATUSES.has(item.status);
    const [documents, history] = await Promise.all([
      getMotorFraudDocumentsDb(pool, item.id),
      getMotorFraudHistoryDb(pool, item.id),
    ]);
    return {
      case: item,
      documents,
      history: filterHistory(req, history),
      access: {
        isInitiator: owner,
        canEditMotorData: (owner || admin) && editable && hasPermission(user, 'motor_fraud.edit'),
        canSubmitMotor: (owner || admin) && editable && hasPermission(user, 'motor_fraud.submit'),
        canCloseReturned: (owner || admin) && item.status.startsWith('Returned to Motor') && hasPermission(user, 'motor_fraud.close_returned'),
        canLegalReview: item.status === 'With Legal' && hasPermission(user, 'motor_fraud.legal_review'),
        canFraudReview: item.status === 'With Fraud' && hasPermission(user, 'motor_fraud.fraud_review'),
        canUploadDocuments: Boolean(documentUploadTeam(req, item)),
        canDownloadDocuments: hasPermission(user, 'motor_fraud.download_documents'),
        canExport: hasPermission(user, 'motor_fraud.export'),
        canSeeLegalComments: admin || hasPermission(user, 'motor_fraud.legal_review') || hasPermission(user, 'motor_fraud.fraud_review'),
        canSeeFraudComments: admin || hasPermission(user, 'motor_fraud.fraud_review'),
      },
    };
  }

  app.get('/api/motor-fraud/cases', requirePermission('motor_fraud.view'), async (req, res) => {
    try {
      const rows = await listMotorFraudCasesDb(pool, getCurrentUserEmail(req), isReviewTeam(req));
      return res.json(rows.filter((item) => canAccess(req, item)));
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load Motor Fraud cases.', error: error.message });
    }
  });

  app.post('/api/motor-fraud/cases', requirePermission('motor_fraud.create'), async (req, res) => {
    try {
      const body = motorPayload(req.body);
      if (!body.claim_number) return res.status(400).json({ message: 'Claim number is required to create a Motor Fraud case.' });
      if (body.reserve_amount !== null && (!Number.isFinite(body.reserve_amount) || body.reserve_amount < 0)) return res.status(400).json({ message: 'Reserve amount must be a valid non-negative number.' });
      validateHierarchy(body);
      const actor = { email: getCurrentUserEmail(req), name: getCurrentUserName(req) };
      const item = await createMotorFraudCaseDb(pool, { ...body, case_number: createCaseNumber() }, actor);
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: 'CASE_CREATED', to_status: item.status, to_team: item.current_team,
        actor_email: actor.email, actor_name: actor.name, actor_team: 'MOTOR',
      });
      return res.status(201).json(item);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to create Motor Fraud case.', error: error.statusCode ? undefined : error.message });
    }
  });

  app.get('/api/motor-fraud/cases/:id', requirePermission('motor_fraud.view'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      return res.json(await buildDetails(req, item));
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load Motor Fraud case.', error: error.message });
    }
  });

  app.patch('/api/motor-fraud/cases/:id', requirePermission('motor_fraud.edit'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (!motorOwnerOrAdmin(req, item) || !EDITABLE_MOTOR_STATUSES.has(item.status)) return res.status(403).json({ message: 'Motor data can only be changed by the initiator while the case is with Motor.' });
      const body = motorPayload(req.body);
      if (body.reserve_amount !== null && body.reserve_amount !== undefined && (!Number.isFinite(body.reserve_amount) || body.reserve_amount < 0)) return res.status(400).json({ message: 'Reserve amount must be a valid non-negative number.' });
      validateHierarchy(body);
      const updated = await updateMotorFraudCaseDb(pool, item.id, body, getCurrentUserEmail(req));
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: 'MOTOR_DATA_UPDATED', from_status: item.status, to_status: item.status,
        from_team: item.current_team, to_team: item.current_team, actor_email: getCurrentUserEmail(req),
        actor_name: getCurrentUserName(req), actor_team: 'MOTOR',
      });
      return res.json(updated);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to update Motor Fraud case.', error: error.statusCode ? undefined : error.message });
    }
  });

  app.post('/api/motor-fraud/cases/:id/documents', requirePermission('motor_fraud.upload_documents'), upload.single('document'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      const uploaderTeam = documentUploadTeam(req, item);
      if (!uploaderTeam) {
        return res.status(403).json({
          message: 'Documents can only be added by the Motor, Legal, or Fraud team while the case is currently assigned to that team.',
        });
      }
      const validationResponse = validateUploadedFile(req.file, res);
      if (validationResponse) return validationResponse;
      const document = await addMotorFraudDocumentDb(pool, item.id, {
        file_name: sanitizeFileName(req.file.originalname), file_type: req.file.mimetype,
        file_size: req.file.size, file_data: req.file.buffer, category: `${uploaderTeam.toLowerCase()}_evidence`,
      }, getCurrentUserEmail(req));
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: 'DOCUMENT_UPLOADED', from_status: item.status, to_status: item.status,
        from_team: item.current_team, to_team: item.current_team, actor_email: getCurrentUserEmail(req),
        actor_name: getCurrentUserName(req), actor_team: uploaderTeam, public_message: `Document uploaded: ${document.file_name}`,
      });
      return res.status(201).json(document);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to upload Motor Fraud document.', error: error.message });
    }
  });

  app.get('/api/motor-fraud/documents/:documentId/download', requirePermission('motor_fraud.download_documents'), async (req, res) => {
    try {
      const document = await getMotorFraudDocumentDb(pool, req.params.documentId);
      if (!document) return res.status(404).json({ message: 'Document not found.' });
      const item = await getMotorFraudCaseDb(pool, document.motor_fraud_case_id);
      if (!canAccess(req, item)) return res.status(403).json({ message: 'You are not allowed to download this document.' });
      const buffer = Buffer.isBuffer(document.file_data) ? document.file_data : Buffer.from(document.file_data);
      res.setHeader('Content-Type', document.file_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(document.file_name)}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(buffer);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to download Motor Fraud document.', error: error.message });
    }
  });

  app.post('/api/motor-fraud/cases/:id/submit', requirePermission('motor_fraud.submit'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (!motorOwnerOrAdmin(req, item) || !EDITABLE_MOTOR_STATUSES.has(item.status)) return res.status(403).json({ message: 'This Motor Fraud case cannot be submitted from its current status.' });
      validateSubmission(item);

      let status; let team; let actionCode; let first = false;
      if (item.status === 'Draft') {
        status = 'With Legal'; team = 'LEGAL'; actionCode = 'SUBMITTED_TO_LEGAL'; first = true;
      } else if (item.return_to_team === 'LEGAL') {
        status = 'With Legal'; team = 'LEGAL'; actionCode = 'RESUBMITTED_TO_LEGAL';
      } else if (item.return_to_team === 'FRAUD') {
        status = 'With Fraud'; team = 'FRAUD'; actionCode = 'RESUBMITTED_TO_FRAUD';
      } else {
        return res.status(400).json({ message: 'The return destination for this case is not available.' });
      }

      const updated = await transitionMotorFraudCaseDb(pool, item.id, {
        status, current_team: team, return_to_team: null, actor_email: getCurrentUserEmail(req), set_first_escalation: first,
      });
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: actionCode, from_status: item.status, to_status: status, from_team: item.current_team, to_team: team,
        actor_email: getCurrentUserEmail(req), actor_name: getCurrentUserName(req), actor_team: 'MOTOR',
      });
      return res.json(updated);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to submit Motor Fraud case.', error: error.statusCode ? undefined : error.message });
    }
  });

  app.post('/api/motor-fraud/cases/:id/legal-decision', requirePermission('motor_fraud.legal_review'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (item.status !== 'With Legal') return res.status(400).json({ message: 'This case is not currently awaiting Legal review.' });
      const decision = String(req.body?.decision || '').toLowerCase();
      const internalComment = String(req.body?.internal_comment || '').trim();
      const returnRequest = String(req.body?.return_request || '').trim();
      if (!internalComment) return res.status(400).json({ message: 'Legal internal comment is required.' });
      if (!['approve', 'return'].includes(decision)) return res.status(400).json({ message: 'Legal decision must be approve or return.' });
      if (decision === 'return' && !returnRequest) return res.status(400).json({ message: 'A return request for Motor is required.' });

      const transition = decision === 'approve'
        ? { status: 'With Fraud', current_team: 'FRAUD', return_to_team: null, set_second_escalation: true }
        : { status: 'Returned to Motor from Legal', current_team: 'MOTOR', return_to_team: 'LEGAL' };
      const updated = await transitionMotorFraudCaseDb(pool, item.id, { ...transition, actor_email: getCurrentUserEmail(req) });
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: decision === 'approve' ? 'LEGAL_APPROVED' : 'LEGAL_RETURNED',
        from_status: item.status, to_status: transition.status, from_team: 'LEGAL', to_team: transition.current_team,
        actor_email: getCurrentUserEmail(req), actor_name: getCurrentUserName(req), actor_team: 'LEGAL',
        public_message: decision === 'return' ? returnRequest : null, internal_comment: internalComment,
      });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to record Legal decision.', error: error.message });
    }
  });

  app.post('/api/motor-fraud/cases/:id/fraud-decision', requirePermission('motor_fraud.fraud_review'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (item.status !== 'With Fraud') return res.status(400).json({ message: 'This case is not currently awaiting Fraud review.' });
      const decision = String(req.body?.decision || '').toLowerCase();
      const internalComment = String(req.body?.internal_comment || '').trim();
      const returnRequest = String(req.body?.return_request || '').trim();
      if (!internalComment) return res.status(400).json({ message: 'Fraud internal comment is required.' });
      if (!['close', 'reject', 'return'].includes(decision)) return res.status(400).json({ message: 'Fraud decision must be close, reject, or return.' });
      if (decision === 'return' && !returnRequest) return res.status(400).json({ message: 'A return request for Motor is required.' });

      let transition;
      let actionCode;
      if (decision === 'return') {
        transition = { status: 'Returned to Motor from Fraud', current_team: 'MOTOR', return_to_team: 'FRAUD' };
        actionCode = 'FRAUD_RETURNED';
      } else if (decision === 'reject') {
        transition = { status: 'Rejected', current_team: 'CLOSED', return_to_team: null, close_now: true, closure_outcome: 'Rejected' };
        actionCode = 'FRAUD_REJECTED';
      } else {
        transition = { status: 'Closed', current_team: 'CLOSED', return_to_team: null, close_now: true, closure_outcome: 'Closed' };
        actionCode = 'FRAUD_CLOSED';
      }
      const updated = await transitionMotorFraudCaseDb(pool, item.id, { ...transition, actor_email: getCurrentUserEmail(req) });
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: actionCode, from_status: item.status, to_status: transition.status, from_team: 'FRAUD', to_team: transition.current_team,
        actor_email: getCurrentUserEmail(req), actor_name: getCurrentUserName(req), actor_team: 'FRAUD',
        public_message: decision === 'return' ? returnRequest : null, internal_comment: internalComment,
      });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to record Fraud decision.', error: error.message });
    }
  });

  // Explicit final-stage close action. Keeping closure as its own endpoint makes
  // the workflow rule unambiguous: while a case is With Fraud, an authorized
  // Fraud reviewer can close it directly without sending it anywhere else.
  app.post('/api/motor-fraud/cases/:id/fraud-close', requirePermission('motor_fraud.fraud_review'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (item.status !== 'With Fraud') {
        return res.status(400).json({ message: 'Only a case currently with Fraud can be closed by the Fraud team.' });
      }
      const internalComment = String(req.body?.internal_comment || '').trim();
      if (!internalComment) return res.status(400).json({ message: 'Fraud internal comment is required.' });

      const updated = await transitionMotorFraudCaseDb(pool, item.id, {
        status: 'Closed', current_team: 'CLOSED', return_to_team: null,
        actor_email: getCurrentUserEmail(req), close_now: true, closure_outcome: 'Closed',
      });
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: 'FRAUD_CLOSED', from_status: item.status, to_status: 'Closed',
        from_team: 'FRAUD', to_team: 'CLOSED', actor_email: getCurrentUserEmail(req),
        actor_name: getCurrentUserName(req), actor_team: 'FRAUD', internal_comment: internalComment,
      });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to close Motor Fraud case.', error: error.message });
    }
  });

  app.post('/api/motor-fraud/cases/:id/close-returned', requirePermission('motor_fraud.close_returned'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      if (!motorOwnerOrAdmin(req, item) || !item.status.startsWith('Returned to Motor')) return res.status(400).json({ message: 'Only a returned Motor Fraud request can be closed by Motor.' });
      const updated = await transitionMotorFraudCaseDb(pool, item.id, {
        status: 'Closed by Motor', current_team: 'CLOSED', return_to_team: null,
        actor_email: getCurrentUserEmail(req), close_now: true, closure_outcome: 'Closed by Motor',
      });
      await addMotorFraudHistoryDb(pool, item.id, {
        action_code: 'MOTOR_CLOSED_RETURNED', from_status: item.status, to_status: 'Closed by Motor',
        from_team: 'MOTOR', to_team: 'CLOSED', actor_email: getCurrentUserEmail(req), actor_name: getCurrentUserName(req), actor_team: 'MOTOR',
      });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to close returned Motor Fraud case.', error: error.message });
    }
  });

  app.get('/api/motor-fraud/cases/:id/export', requirePermission('motor_fraud.export'), async (req, res) => {
    try {
      const item = await requireCase(req, res);
      if (!item) return;
      const workbook = buildMotorFraudExcel([item]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${item.case_number}.xlsx"`);
      res.setHeader('Content-Length', workbook.length);
      return res.send(workbook);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to export Motor Fraud case.', error: error.message });
    }
  });

  app.post('/api/motor-fraud/export', requirePermission('motor_fraud.export'), async (req, res) => {
    try {
      const allRows = await listMotorFraudCasesDb(pool, getCurrentUserEmail(req), isReviewTeam(req));
      const accessible = allRows.filter((item) => canAccess(req, item));
      const requestedIds = new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map((id) => Number(id)).filter(Number.isFinite));
      const selected = requestedIds.size ? accessible.filter((item) => requestedIds.has(Number(item.id))) : accessible;
      if (!selected.length) return res.status(400).json({ message: 'There are no Motor Fraud cases to export.' });
      const workbook = buildMotorFraudExcel(selected.slice(0, 5000));
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Motor_Fraud_Cases_${stamp}.xlsx"`);
      res.setHeader('Content-Length', workbook.length);
      return res.send(workbook);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to export Motor Fraud cases.', error: error.message });
    }
  });
}

module.exports = { registerMotorFraudRoutes };
