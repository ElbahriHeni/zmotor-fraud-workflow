import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiDownload, apiGet, apiPatch, apiPost, apiUploadFormData } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import { MOTOR_FRAUD_SOURCES, findMotorFraudIndicator, motorFraudMainIndicators, motorFraudSubIndicators } from '../../data/motorFraudIndicators';
import type { MotorFraudCase, MotorFraudDetailsResponse, MotorFraudDocument, MotorFraudHistory } from '../../types/motorFraud';

const emptyForm = {
  claim_number: '',
  reserve_amount: '',
  accident_number: '',
  claim_type: '',
  indicator_source: '',
  main_indicator: '',
  sub_indicator: '',
  indicator_classification: '',
  action_taken: '',
  received_date: '',
  comment_date: '',
  administrative_entity: '',
  employee_name: '',
  objection_received_date: '',
};

type MotorForm = typeof emptyForm;

function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB');
}


function dayDiffInput(fromValue: string, toValue: string) {
  if (!fromValue || !toValue) return '';
  const from = new Date(`${fromValue}T00:00:00Z`);
  const to = new Date(`${toValue}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
  return String(Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000)));
}

function toForm(item: MotorFraudCase): MotorForm {
  return {
    claim_number: item.claim_number || '',
    reserve_amount: item.reserve_amount === null || item.reserve_amount === undefined ? '' : String(item.reserve_amount),
    accident_number: item.accident_number || '',
    claim_type: item.claim_type || '',
    indicator_source: item.indicator_source || '',
    main_indicator: item.main_indicator || '',
    sub_indicator: item.sub_indicator || '',
    indicator_classification: item.indicator_classification || '',
    action_taken: item.action_taken || '',
    received_date: inputDate(item.received_date),
    comment_date: inputDate(item.comment_date),
    administrative_entity: item.administrative_entity || '',
    employee_name: item.employee_name || '',
    objection_received_date: inputDate(item.objection_received_date),
  };
}

function statusLabel(status: string, ar: boolean) {
  const labels: Record<string, [string, string]> = {
    Draft: ['Draft', 'مسودة'],
    'With Legal': ['With Legal', 'لدى الفريق القانوني'],
    'Returned to Motor from Legal': ['Returned by Legal', 'معاد من القانونية للمركبات'],
    'With Fraud': ['With Fraud', 'لدى فريق الاحتيال'],
    'Returned to Motor from Fraud': ['Returned by Fraud', 'معاد من الاحتيال للمركبات'],
    Closed: ['Closed', 'مغلق'],
    Rejected: ['Rejected / Closed', 'مرفوض / مغلق'],
    'Closed by Motor': ['Closed by Motor', 'مغلق من فريق المركبات'],
  };
  return labels[status]?.[ar ? 1 : 0] || status;
}

function actionLabel(code: string, ar: boolean) {
  const labels: Record<string, [string, string]> = {
    CASE_CREATED: ['Case created', 'تم إنشاء الحالة'],
    MOTOR_DATA_UPDATED: ['Motor data updated', 'تم تحديث بيانات المركبات'],
    DOCUMENT_UPLOADED: ['Document uploaded', 'تم رفع مستند'],
    SUBMITTED_TO_LEGAL: ['Submitted to Legal', 'تم التصعيد إلى القانونية'],
    RESUBMITTED_TO_LEGAL: ['Resubmitted to Legal', 'تمت إعادة الإرسال إلى القانونية'],
    LEGAL_RETURNED: ['Returned by Legal', 'تمت الإعادة من القانونية'],
    LEGAL_APPROVED: ['Legal approved / escalated to Fraud', 'اعتماد القانونية والتصعيد للاحتيال'],
    RESUBMITTED_TO_FRAUD: ['Resubmitted to Fraud', 'تمت إعادة الإرسال إلى الاحتيال'],
    FRAUD_RETURNED: ['Returned by Fraud', 'تمت الإعادة من الاحتيال'],
    FRAUD_CLOSED: ['Closed by Fraud', 'تم الإغلاق من الاحتيال'],
    FRAUD_REJECTED: ['Rejected by Fraud', 'تم الرفض والإغلاق من الاحتيال'],
    MOTOR_CLOSED_RETURNED: ['Closed by Motor after return', 'تم الإغلاق من المركبات بعد الإعادة'],
  };
  return labels[code]?.[ar ? 1 : 0] || code.replace(/_/g, ' ');
}

export default function MotorFraudCasePage() {
  const { caseId } = useParams();
  // /app/motor-fraud/new is a dedicated route, so useParams() has no caseId there.
  // Treat a missing caseId as a new case; otherwise the page can stay in the loading state forever.
  const isNew = !caseId || caseId === 'new';
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const ar = language === 'ar';
  const [details, setDetails] = useState<MotorFraudDetailsResponse | null>(null);
  const [form, setForm] = useState<MotorForm>(emptyForm);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [legalComment, setLegalComment] = useState('');
  const [legalReturnRequest, setLegalReturnRequest] = useState('');
  const [fraudComment, setFraudComment] = useState('');
  const [fraudReturnRequest, setFraudReturnRequest] = useState('');

  const canCreate = hasPermission(currentUser, 'motor_fraud.create');
  const canEdit = isNew ? canCreate : Boolean(details?.access.canEditMotorData);
  const canUpload = isNew ? canCreate : Boolean(details?.access.canUploadDocuments);

  const load = async (id = caseId) => {
    if (!id || id === 'new') return;
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<MotorFraudDetailsResponse>(`/api/motor-fraud/cases/${id}`);
      setDetails(data);
      setForm(toForm(data.case));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the Motor Fraud case.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      setDetails(null);
      setForm(emptyForm);
      return;
    }
    void load(caseId);
  }, [caseId, isNew]);

  const mainOptions = useMemo(() => motorFraudMainIndicators(form.indicator_source), [form.indicator_source]);
  const subOptions = useMemo(() => motorFraudSubIndicators(form.indicator_source, form.main_indicator), [form.indicator_source, form.main_indicator]);

  const setField = (field: keyof MotorForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSource = (value: string) => setForm((current) => ({ ...current, indicator_source: value, main_indicator: '', sub_indicator: '', indicator_classification: '' }));
  const handleMain = (value: string) => setForm((current) => ({ ...current, main_indicator: value, sub_indicator: '', indicator_classification: '' }));
  const handleSub = (value: string) => {
    const match = findMotorFraudIndicator(form.indicator_source, form.main_indicator, value);
    setForm((current) => ({ ...current, sub_indicator: value, indicator_classification: match?.classification || '' }));
  };

  const validateForSubmit = () => {
    const required: Array<keyof MotorForm> = [
      'claim_number','reserve_amount','accident_number','claim_type','indicator_source','main_indicator','sub_indicator',
      'indicator_classification','action_taken','received_date','comment_date','administrative_entity','employee_name','objection_received_date',
    ];
    const missing = required.find((field) => !String(form[field] ?? '').trim());
    if (missing) throw new Error(ar ? 'يرجى استكمال جميع حقول بيانات المركبات قبل التصعيد.' : 'Complete all Motor data fields before submitting.');
  };

  const payload = () => ({
    ...form,
    reserve_amount: form.reserve_amount === '' ? null : Number(form.reserve_amount),
  });

  const uploadFiles = async (id: number) => {
    for (const file of pendingFiles) {
      const data = new FormData();
      data.append('document', file);
      await apiUploadFormData(`/api/motor-fraud/cases/${id}/documents`, data);
    }
    setPendingFiles([]);
  };

  const handleUploadDocuments = async () => {
    if (!details || isNew) {
      setError(ar ? 'احفظ الحالة أولاً قبل رفع المستندات.' : 'Save the case before uploading documents.');
      return;
    }
    if (!pendingFiles.length) {
      setError(ar ? 'اختر مستنداً واحداً على الأقل.' : 'Select at least one document to upload.');
      return;
    }
    try {
      setSaving(true); setError(''); setMessage('');
      await uploadFiles(details.case.id);
      await load(String(details.case.id));
      setMessage(ar ? 'تم رفع المستندات بنجاح.' : 'Documents uploaded successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveMotorData = async () => {
    if (!canEdit) throw new Error(ar ? 'ليس لديك صلاحية تعديل هذه الحالة.' : 'You cannot edit this case.');
    if (isNew) {
      const created = await apiPost<MotorFraudCase>('/api/motor-fraud/cases', payload());
      await uploadFiles(created.id);
      navigate(`/app/motor-fraud/${created.id}`, { replace: true });
      return created.id;
    }
    await apiPatch(`/api/motor-fraud/cases/${caseId}`, payload());
    if (caseId) await uploadFiles(Number(caseId));
    await load();
    return Number(caseId);
  };

  const handleSave = async () => {
    try {
      setSaving(true); setError(''); setMessage('');
      await saveMotorData();
      setMessage(ar ? 'تم حفظ بيانات الحالة.' : 'Motor Fraud case saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true); setError(''); setMessage(''); validateForSubmit();
      const id = await saveMotorData();
      await apiPost(`/api/motor-fraud/cases/${id}/submit`, {});
      await load(String(id));
      setMessage(ar ? 'تم إرسال الحالة إلى الفريق المختص.' : 'Case submitted to the review team.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Submit failed.'); }
    finally { setSaving(false); }
  };

  const legalDecision = async (decision: 'approve' | 'return') => {
    if (!details) return;
    try {
      if (!legalComment.trim()) throw new Error(ar ? 'تعليق الفريق القانوني مطلوب.' : 'Legal comment is required.');
      if (decision === 'return' && !legalReturnRequest.trim()) throw new Error(ar ? 'طلب البيانات الإضافية مطلوب.' : 'Return request is required.');
      setSaving(true); setError(''); setMessage('');
      // Upload any evidence selected by Legal before moving the case to Fraud/Motor.
      if (pendingFiles.length) await uploadFiles(details.case.id);
      await apiPost(`/api/motor-fraud/cases/${details.case.id}/legal-decision`, {
        decision,
        internal_comment: legalComment,
        return_request: decision === 'return' ? legalReturnRequest : '',
      });
      setLegalComment(''); setLegalReturnRequest(''); await load(String(details.case.id));
      setMessage(decision === 'approve' ? (ar ? 'تم اعتماد الحالة وتصعيدها إلى فريق الاحتيال.' : 'Approved and escalated to Fraud.') : (ar ? 'تمت إعادة الحالة إلى فريق المركبات.' : 'Returned to Motor.'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Legal action failed.'); }
    finally { setSaving(false); }
  };

  const fraudDecision = async (decision: 'close' | 'reject' | 'return') => {
    if (!details) return;
    try {
      if (!fraudComment.trim()) throw new Error(ar ? 'تعليق فريق الاحتيال مطلوب.' : 'Fraud comment is required.');
      if (decision === 'return' && !fraudReturnRequest.trim()) throw new Error(ar ? 'طلب البيانات الإضافية مطلوب.' : 'Return request is required.');
      if ((decision === 'close' || decision === 'reject') && !window.confirm(
        decision === 'close'
          ? (ar ? 'هل تريد إغلاق الحالة نهائياً؟' : 'Close this case as the final Fraud decision?')
          : (ar ? 'هل تريد رفض الحالة وإغلاقها نهائياً؟' : 'Reject and close this case?')
      )) return;
      setSaving(true); setError(''); setMessage('');
      // Upload any evidence selected by Fraud before the final/return transition.
      if (pendingFiles.length) await uploadFiles(details.case.id);
      if (decision === 'close') {
        await apiPost(`/api/motor-fraud/cases/${details.case.id}/fraud-close`, {
          internal_comment: fraudComment,
        });
      } else {
        await apiPost(`/api/motor-fraud/cases/${details.case.id}/fraud-decision`, {
          decision,
          internal_comment: fraudComment,
          return_request: decision === 'return' ? fraudReturnRequest : '',
        });
      }
      setFraudComment(''); setFraudReturnRequest(''); await load(String(details.case.id));
      setMessage(
        decision === 'close'
          ? (ar ? 'تم إغلاق الحالة بواسطة فريق الاحتيال.' : 'Case closed by Fraud.')
          : decision === 'reject'
            ? (ar ? 'تم رفض الحالة وإغلاقها.' : 'Case rejected and closed.')
            : (ar ? 'تمت إعادة الحالة إلى فريق المركبات.' : 'Case returned to Motor.')
      );
    } catch (err) { setError(err instanceof Error ? err.message : 'Fraud action failed.'); }
    finally { setSaving(false); }
  };

  const closeReturned = async () => {
    if (!details) return;
    if (!window.confirm(ar ? 'هل تريد إغلاق الحالة بدلاً من إعادة إرسالها؟' : 'Close this returned request instead of resubmitting it?')) return;
    try {
      setSaving(true); setError('');
      await apiPost(`/api/motor-fraud/cases/${details.case.id}/close-returned`, {});
      await load(String(details.case.id));
      setMessage(ar ? 'تم إغلاق الحالة بواسطة فريق المركبات.' : 'Case closed by Motor.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not close the case.'); }
    finally { setSaving(false); }
  };

  if (isNew && !canCreate) return <div className="notice error">{ar ? 'ليس لديك صلاحية إنشاء حالة احتيال مركبات.' : 'You do not have permission to create Motor Fraud cases.'}</div>;
  if (loading) return <div className="card"><p className="muted">{ar ? 'جاري تحميل الحالة...' : 'Loading Motor Fraud case...'}</p></div>;

  const item = details?.case;
  const receptionDays = item?.reception_comment_days ?? dayDiffInput(form.received_date, form.comment_date);
  const returned = item?.status === 'Returned to Motor from Legal' || item?.status === 'Returned to Motor from Fraud';
  const canSubmit = isNew ? canCreate : Boolean(details?.access.canSubmitMotor);

  return (
    <div>
      <PageHeader
        eyebrow={ar ? 'احتيال المركبات' : 'Motor Fraud'}
        title={isNew ? (ar ? 'إنشاء حالة احتيال مركبات' : 'Create Motor Fraud Case') : (item?.case_number || 'Motor Fraud Case')}
        subtitle={isNew ? (ar ? 'إدخال بيانات الحالة والمستندات ثم التصعيد.' : 'Enter Motor case data and documents, then submit it into the workflow.') : `${statusLabel(item?.status || '', ar)} · ${item?.claim_number || ''}`}
        action={<Link className="btn" to="/app/motor-fraud">{ar ? 'العودة للقائمة' : 'Back to List'}</Link>}
      />

      {error ? <div className="notice error">{error}</div> : null}
      {message ? <div className="notice success">{message}</div> : null}

      {item ? (
        <div className="motor-summary-grid">
          <div className="card motor-summary-item"><span>{ar ? 'الحالة' : 'Status'}</span><strong>{statusLabel(item.status, ar)}</strong></div>
          <div className="card motor-summary-item"><span>{ar ? 'تاريخ التصعيد الأول' : 'First Escalation'}</span><strong>{formatDateTime(item.first_escalation_at)}</strong><small>{item.first_escalation_days ?? '-'} {ar ? 'يوم' : 'days'}</small></div>
          <div className="card motor-summary-item"><span>{ar ? 'تاريخ التصعيد الثاني' : 'Second Escalation'}</span><strong>{formatDateTime(item.second_escalation_at)}</strong><small>{item.second_escalation_days ?? '-'} {ar ? 'يوم' : 'days'}</small></div>
          <div className="card motor-summary-item"><span>{ar ? 'أنشأها' : 'Initiated By'}</span><strong>{item.created_by_name || item.created_by}</strong></div>
        </div>
      ) : null}

      {returned && details?.access.isInitiator ? (
        <div className="notice warning"><strong>{ar ? 'الحالة معادة إلى فريق المركبات.' : 'This case was returned to Motor.'}</strong> {ar ? 'يمكنك استكمال البيانات وإعادة الإرسال أو إغلاق الطلب.' : 'You may provide the requested information and resubmit, or close the request.'}</div>
      ) : null}

      <section className="card motor-form-card">
        <div className="section-heading"><div><span className="eyebrow">{ar ? 'بيانات المركبات' : 'Motor Data'}</span><h2>{ar ? 'بيانات حالة الاشتباه' : 'Suspected Motor Fraud Details'}</h2></div></div>
        <div className="motor-form-grid">
          <label><span>رقم المطالبة</span><input disabled={!canEdit} value={form.claim_number} onChange={(e) => setField('claim_number', e.target.value)} /></label>
          <label><span>المبلغ الاحتياطي</span><input disabled={!canEdit} type="number" min="0" step="0.01" value={form.reserve_amount} onChange={(e) => setField('reserve_amount', e.target.value)} /></label>
          <label><span>رقم الحادث</span><input disabled={!canEdit} value={form.accident_number} onChange={(e) => setField('accident_number', e.target.value)} /></label>
          <label><span>نوع المطالبة</span><input disabled={!canEdit} value={form.claim_type} onChange={(e) => setField('claim_type', e.target.value)} /></label>

          <label><span>مصدر المؤشر</span><select disabled={!canEdit} value={form.indicator_source} onChange={(e) => handleSource(e.target.value)}><option value="">--</option>{MOTOR_FRAUD_SOURCES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>المؤشر الرئيسي</span><select disabled={!canEdit || !form.indicator_source} value={form.main_indicator} onChange={(e) => handleMain(e.target.value)}><option value="">--</option>{mainOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="motor-wide-field"><span>المؤشر الفرعي</span><select disabled={!canEdit || !form.main_indicator} value={form.sub_indicator} onChange={(e) => handleSub(e.target.value)}><option value="">--</option>{subOptions.map((value) => <option key={value.sub} value={value.sub}>{value.sub}</option>)}</select></label>
          <label><span>تصنيف المؤشر</span><select disabled value={form.indicator_classification}><option value="">--</option>{form.indicator_classification ? <option value={form.indicator_classification}>{form.indicator_classification}</option> : null}</select></label>

          <label className="motor-wide-field"><span>الإجراء</span><textarea disabled={!canEdit} rows={3} value={form.action_taken} onChange={(e) => setField('action_taken', e.target.value)} /></label>
          <label><span>تاريخ الاستلام</span><input disabled={!canEdit} type="date" value={form.received_date} onChange={(e) => setField('received_date', e.target.value)} /></label>
          <label><span>تاريخ التعليق</span><input disabled={!canEdit} type="date" value={form.comment_date} onChange={(e) => setField('comment_date', e.target.value)} /></label>
          <label><span>حاسبة الأيام</span><input disabled value={receptionDays} placeholder={ar ? 'تلقائي' : 'Automatic'} /></label>
          <label><span>الجهة الإدارية</span><input disabled={!canEdit} value={form.administrative_entity} onChange={(e) => setField('administrative_entity', e.target.value)} /></label>
          <label><span>اسم الموظف</span><input disabled={!canEdit} value={form.employee_name} onChange={(e) => setField('employee_name', e.target.value)} /></label>
          <label><span>تاريخ استلام الاعتراض</span><input disabled={!canEdit} type="date" value={form.objection_received_date} onChange={(e) => setField('objection_received_date', e.target.value)} /></label>
        </div>
      </section>

      <section className="card motor-form-card">
        <div className="section-heading"><div><span className="eyebrow">{ar ? 'المستندات' : 'Evidence'}</span><h2>{ar ? 'المرفقات' : 'Documents'}</h2></div></div>
        {canUpload ? <label className="motor-file-picker"><span>{ar ? 'إضافة مستندات' : 'Add documents'}</span><input type="file" multiple onChange={(e) => setPendingFiles(Array.from(e.target.files || []))} /><small>{pendingFiles.length ? `${pendingFiles.length} ${ar ? 'ملف محدد' : 'file(s) selected'}` : (ar ? 'PDF / صور / Word / Excel / TXT — حد 15MB لكل ملف' : 'PDF / images / Word / Excel / TXT — 15MB per file')}</small></label> : null}
        {canUpload && !isNew ? <div className="motor-review-actions"><button className="btn primary" type="button" disabled={saving || pendingFiles.length === 0} onClick={handleUploadDocuments}>{ar ? 'رفع المستندات المحددة' : 'Upload Selected Documents'}</button></div> : null}
        {isNew && canUpload && pendingFiles.length ? <p className="muted">{ar ? 'سيتم رفع المستندات عند حفظ الحالة.' : 'Selected documents will be uploaded when the case is saved.'}</p> : null}
        {details?.documents.length ? <div className="motor-document-list">{details.documents.map((doc: MotorFraudDocument) => <div key={doc.id}><div><strong>{doc.file_name}</strong><small>{doc.uploaded_by || '-'} · {formatDateTime(doc.uploaded_at)}</small></div>{details.access.canDownloadDocuments ? <button className="btn small" type="button" onClick={() => apiDownload(`/api/motor-fraud/documents/${doc.id}/download`, doc.file_name)}>{ar ? 'تنزيل' : 'Download'}</button> : null}</div>)}</div> : <p className="muted">{ar ? 'لا توجد مستندات مرفقة.' : 'No documents attached yet.'}</p>}
      </section>

      {(canEdit || canSubmit || returned) ? (
        <div className="motor-action-bar">
          {canEdit ? <button className="btn" disabled={saving} onClick={handleSave}>{ar ? 'حفظ' : 'Save'}</button> : null}
          {canSubmit ? <button className="btn primary" disabled={saving} onClick={handleSubmit}>{returned ? (ar ? 'إعادة الإرسال' : 'Resubmit') : (ar ? 'إرسال إلى القانونية' : 'Submit to Legal')}</button> : null}
          {returned && details?.access.canCloseReturned ? <button className="btn danger" disabled={saving} onClick={closeReturned}>{ar ? 'إغلاق الطلب' : 'Close Request'}</button> : null}
          {details?.access.canExport ? <button className="btn" disabled={saving} onClick={() => apiDownload(`/api/motor-fraud/cases/${details.case.id}/export`, `${details.case.case_number}.xlsx`)}>{ar ? 'تصدير الحالة' : 'Export Case'}</button> : null}
        </div>
      ) : details?.access.canExport ? <div className="motor-action-bar"><button className="btn" onClick={() => apiDownload(`/api/motor-fraud/cases/${details.case.id}/export`, `${details.case.case_number}.xlsx`)}>{ar ? 'تصدير الحالة' : 'Export Case'}</button></div> : null}

      {details?.access.canLegalReview && item?.status === 'With Legal' ? (
        <section className="card motor-review-card">
          <span className="eyebrow">{ar ? 'المراجعة القانونية' : 'Legal Review'}</span><h2>{ar ? 'قرار الفريق القانوني' : 'Legal Decision'}</h2>
          <label><span>{ar ? 'تعليق قانوني داخلي' : 'Internal Legal Comment'}</span><textarea rows={4} value={legalComment} onChange={(e) => setLegalComment(e.target.value)} placeholder={ar ? 'هذا التعليق غير ظاهر لفريق المركبات.' : 'This comment is hidden from the Motor initiator.'} /></label>
          <label><span>{ar ? 'طلب بيانات إضافية لفريق المركبات (عند الإعادة)' : 'Request to Motor (required when returning)'}</span><textarea rows={3} value={legalReturnRequest} onChange={(e) => setLegalReturnRequest(e.target.value)} /></label>
          <div className="motor-review-actions"><button className="btn" disabled={saving} onClick={() => legalDecision('return')}>{ar ? 'إعادة للمركبات' : 'Return to Motor'}</button><button className="btn primary" disabled={saving} onClick={() => legalDecision('approve')}>{ar ? 'اعتماد وتصعيد للاحتيال' : 'Approve & Escalate to Fraud'}</button></div>
        </section>
      ) : null}

      {details?.access.canFraudReview && item?.status === 'With Fraud' ? (
        <section className="card motor-review-card">
          <span className="eyebrow">{ar ? 'مراجعة الاحتيال' : 'Fraud Review'}</span><h2>{ar ? 'قرار فريق الاحتيال' : 'Fraud Decision'}</h2>
          <label><span>{ar ? 'تعليق احتيال داخلي' : 'Internal Fraud Comment'}</span><textarea rows={4} value={fraudComment} onChange={(e) => setFraudComment(e.target.value)} placeholder={ar ? 'هذا التعليق غير ظاهر لفريق المركبات.' : 'This comment is hidden from the Motor initiator.'} /></label>
          <label><span>{ar ? 'طلب بيانات إضافية لفريق المركبات (عند الإعادة)' : 'Request to Motor (required when returning)'}</span><textarea rows={3} value={fraudReturnRequest} onChange={(e) => setFraudReturnRequest(e.target.value)} /></label>
          <div className="motor-review-actions"><button className="btn" disabled={saving} onClick={() => fraudDecision('return')}>{ar ? 'إعادة للمركبات' : 'Return to Motor'}</button><button className="btn danger" disabled={saving} onClick={() => fraudDecision('reject')}>{ar ? 'رفض وإغلاق' : 'Reject & Close'}</button><button className="btn primary" disabled={saving} onClick={() => fraudDecision('close')}>{ar ? 'إغلاق' : 'Close'}</button></div>
        </section>
      ) : null}

      {details ? (
        <section className="card motor-history-card">
          <span className="eyebrow">{ar ? 'السجل' : 'Workflow Log'}</span><h2>{ar ? 'سجل كامل للحالة' : 'Case Workflow History'}</h2>
          <div className="motor-history-list">
            {details.history.map((entry: MotorFraudHistory) => <div key={entry.id} className="motor-history-entry"><div className="motor-history-dot" /><div><div className="motor-history-head"><strong>{actionLabel(entry.action_code, ar)}</strong><span>{formatDateTime(entry.created_at)}</span></div><p className="muted">{entry.actor_name || entry.actor_email || '-'}</p>{entry.public_message ? <div className="motor-public-request"><strong>{ar ? 'طلب / ملاحظة لفريق المركبات:' : 'Request / message to Motor:'}</strong> {entry.public_message}</div> : null}{entry.internal_comment ? <div className="motor-internal-comment"><strong>{ar ? 'تعليق داخلي:' : 'Internal comment:'}</strong> {entry.internal_comment}</div> : null}</div></div>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
