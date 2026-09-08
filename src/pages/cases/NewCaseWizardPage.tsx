import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiPost, apiUploadFormData } from '../../api';
import type { AppLanguage, AppOutletContext } from '../../layout/AppLayout';

async function uploadCaseDocument(caseNumber: string, file: File, uploadedBy: string) {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('category', 'supporting_document');
  formData.append('uploaded_by', uploadedBy);

  return apiUploadFormData(`/api/cases/${caseNumber}/upload-document`, formData);
}

type WizardStep =
  | 'reporter'
  | 'overview'
  | 'fraudIndicators'
  | 'attachments'
  | 'actionLog';

type CreateCaseResponse = {
  id: number;
  case_number: string;
};

type FormState = {
  reporterName: string;
  reporterEmail: string;
  reporterMobile: string;
  nationalIdOrIqama: string;
  consentToTerms: boolean;

  caseEntryDate: string;
  caseSource: string;
  caseSourceOther: string;
  caseType: string;
  priorityLevel: string;
  caseStatus: string;
  insuranceType: string;
  hasClaim: boolean;
  description: string;
  suspectedAmount: string;

  claimNumber: string;
  claimType: string;
  suspensionDate: string;
  suspensionReason: string;

  fraudConfirmedDate: string;
  fraudDetectionMethod: string;
  fraudAmount: string;
  actionTaken: string;
  referredEntity: string;
  fraudIndicatorType: string;
  indicatorDescription: string;
  occurrenceCount: string;
  riskLevel: string;

  fraudUnitNotes: string;
  closureReason: string;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const generatedCaseNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `FC-${yyyy}${mm}${dd}-${random}`;
};

const daysBetweenToday = (dateValue: string) => {
  if (!dateValue) return '';
  const start = new Date(`${dateValue}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime())) return '';

  const diff = today.getTime() - start.getTime();
  return String(Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24))));
};

const maps = {
  caseSource: {
    الموقع: 'Website',
    داخلي: 'Internal',
    أخرى: 'Other',
    Website: 'Website',
    Internal: 'Internal',
    Other: 'Other',
  },
  caseType: {
    'احتيال مؤكد': 'Fraud Confirmed',
    'اشتباه الاحتيال': 'Fraud Suspected',
    مخالفة: 'Violation',
    'Fraud Confirmed': 'Fraud Confirmed',
    'Fraud Suspected': 'Fraud Suspected',
    Violation: 'Violation',
  },
  priority: {
    عالية: 'High',
    متوسطة: 'Medium',
    منخفضة: 'Low',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
  },
  insurance: {
    مركبات: 'Motor',
    طبي: 'Medical',
    حياة: 'Life',
    عام: 'General',
    'غير منطبق': 'Not Applicable',
    Motor: 'Motor',
    Medical: 'Medical',
    Life: 'Life',
    General: 'General',
    'Not Applicable': 'Not Applicable',
  },
  risk: {
    عالية: 'High',
    متوسطة: 'Medium',
    منخفضة: 'Low',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
  },
  status: {
    مفتوح: 'Open',
    معلق: 'Suspended',
    مغلق: 'Closed',
    Open: 'Open',
    Suspended: 'Suspended',
    Closed: 'Closed',
  },
} as const;

const mapValue = (value: string, mapping: Record<string, string>) => mapping[value] ?? value;

const copy = {
  en: {
    title: 'New Case',
    subtitle: 'Create a fraud case using the guided case workflow.',
    submit: 'Create Case',
    submitting: 'Submitting...',
    next: 'Next',
    back: 'Back',
    saveDraft: 'Save Draft',
    error: 'Could not create the case. Please check the backend and try again.',
    steps: {
      reporter: 'Reporter Details',
      overview: 'Case Overview',
      fraudIndicators: 'Fraud Indicators',
      attachments: 'Attachments',
      actionLog: 'Action Log',
    },
  },
  ar: {
    title: 'بلاغ جديد',
    subtitle: 'إنشاء بلاغ احتيال باستخدام مسار عمل واضح ومبسط.',
    submit: 'إنشاء البلاغ',
    submitting: 'جاري الإرسال...',
    next: 'التالي',
    back: 'السابق',
    saveDraft: 'حفظ كمسودة',
    error: 'تعذر إنشاء البلاغ. يرجى التحقق من الخادم والمحاولة مرة أخرى.',
    steps: {
      reporter: 'بيانات المبلّغ',
      overview: 'نظرة عامة على البلاغ',
      fraudIndicators: 'مؤشرات الاحتيال',
      attachments: 'المرفقات',
      actionLog: 'سجل الإجراءات',
    },
  },
};

export default function NewCaseWizardPage() {
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const t = copy[language];
  const isArabic = language === 'ar';

  const [currentStep, setCurrentStep] = useState<WizardStep>('reporter');
  const [caseNumber] = useState(generatedCaseNumber());
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [form, setForm] = useState<FormState>({
    reporterName: '',
    reporterEmail: '',
    reporterMobile: '',
    nationalIdOrIqama: '',
    consentToTerms: false,

    caseEntryDate: todayInputValue(),
    caseSource: isArabic ? 'الموقع' : 'Website',
    caseSourceOther: '',
    caseType: isArabic ? 'اشتباه الاحتيال' : 'Fraud Suspected',
    priorityLevel: isArabic ? 'متوسطة' : 'Medium',
    caseStatus: isArabic ? 'مفتوح' : 'Open',
    insuranceType: isArabic ? 'غير منطبق' : 'Not Applicable',
    hasClaim: false,
    description: '',
    suspectedAmount: '',

    claimNumber: '',
    claimType: '',
    suspensionDate: '',
    suspensionReason: '',

    fraudConfirmedDate: '',
    fraudDetectionMethod: '',
    fraudAmount: '',
    actionTaken: '',
    referredEntity: '',
    fraudIndicatorType: '',
    indicatorDescription: '',
    occurrenceCount: '',
    riskLevel: isArabic ? 'متوسطة' : 'Medium',

    fraudUnitNotes: '',
    closureReason: '',
  });

  const normalizedCaseType = mapValue(form.caseType, maps.caseType);
  const showFraudIndicators = normalizedCaseType === 'Fraud Confirmed' || normalizedCaseType === 'Fraud Suspected';
  const stepOrder = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = ['reporter', 'overview'];
    if (showFraudIndicators) steps.push('fraudIndicators');
    steps.push('attachments', 'actionLog');
    return steps;
  }, [showFraudIndicators]);

  const currentStepIndex = stepOrder.indexOf(currentStep);
  const progressPercentage = Math.round(((currentStepIndex + 1) / stepOrder.length) * 100);

  const stepHelperText = isArabic
    ? 'تنقّل بين الخطوات، ثم احفظ كمسودة أو أنشئ البلاغ بالحالة المحددة عند الانتهاء.'
    : 'Move between the steps, then save as draft or create the case with the selected status when finished.';

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const goNext = () => {
    if (currentStepIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentStepIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(stepOrder[currentStepIndex - 1]);
    }
  };

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;
    setFiles((current) => [...current, ...Array.from(incomingFiles)]);
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (mode: 'Draft' | 'Selected') => {
    try {
      setIsSubmitting(true);
      setSubmitError('');

      const targetStatus = mode === 'Draft' ? 'Draft' : mapValue(form.caseStatus, maps.status);

      if (targetStatus === 'Closed' && !form.closureReason.trim()) {
        throw new Error(isArabic ? 'سبب الإغلاق مطلوب عند إنشاء بلاغ مغلق.' : 'Closure reason is required when creating a closed case.');
      }

      if (targetStatus === 'Suspended' && (!form.suspensionDate || !form.suspensionReason.trim())) {
        throw new Error(
          isArabic
            ? 'تاريخ التعليق وسبب التعليق مطلوبان عند إنشاء بلاغ معلق.'
            : 'Suspension date and suspension reason are required when creating a suspended case.'
        );
      }

      const createdCase = await apiPost<CreateCaseResponse>('/api/cases', {
        case_number: caseNumber,
        reporter_name: form.reporterName,
        reporter_email: form.reporterEmail,
        reporter_mobile: form.reporterMobile,
        national_id_or_iqama: form.nationalIdOrIqama,
        consent_to_terms_and_privacy: form.consentToTerms,

        case_entry_date: form.caseEntryDate || todayInputValue(),
        case_source: mapValue(form.caseSource, maps.caseSource),
        case_source_other: form.caseSourceOther,
        case_type: mapValue(form.caseType, maps.caseType),
        priority_level: mapValue(form.priorityLevel, maps.priority),
        case_status: targetStatus,
        insurance_type: mapValue(form.insuranceType, maps.insurance),
        has_claim: form.hasClaim,
        suspected_amount: Number(form.suspectedAmount || 0),
        description: form.description,

        claim_id: form.hasClaim ? form.claimNumber : '',
        claim_type: form.hasClaim ? form.claimType : '',
        suspension_date: targetStatus === 'Suspended' ? form.suspensionDate || null : null,
        suspension_reason: targetStatus === 'Suspended' ? form.suspensionReason : '',

        fraud_confirmed_date: showFraudIndicators ? form.fraudConfirmedDate || null : null,
        fraud_detection_method: showFraudIndicators ? form.fraudDetectionMethod : '',
        fraud_amount: showFraudIndicators ? Number(form.fraudAmount || 0) : 0,
        action_taken: showFraudIndicators ? form.actionTaken : '',
        referred_entity: showFraudIndicators ? form.referredEntity : '',
        fraud_indicator_type: showFraudIndicators ? form.fraudIndicatorType : '',
        indicator_description: showFraudIndicators ? form.indicatorDescription : '',
        occurrence_count: showFraudIndicators ? Number(form.occurrenceCount || 0) : 0,
        risk_level: showFraudIndicators ? mapValue(form.riskLevel, maps.risk) : '',

        assigned_user: '',
        assigned_by: '',
        reassignment_reason: '',
        closure_reason: targetStatus === 'Closed' ? form.closureReason : '',
        fraud_unit_notes: form.fraudUnitNotes,

        created_by: currentUser?.email || 'System',
      });

      for (const file of files) {
        await uploadCaseDocument(createdCase.case_number, file, currentUser?.email || 'System');
      }

      navigate(`/app/cases/${createdCase.case_number}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldStyle = { display: 'grid', gap: 8 };

  const renderReporterStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}>
        <span>{isArabic ? 'اسم المبلّغ' : 'Reporter Name'}</span>
        <input value={form.reporterName} onChange={(e) => updateField('reporterName', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span>
        <input type="email" value={form.reporterEmail} onChange={(e) => updateField('reporterEmail', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'رقم الجوال' : 'Mobile Number'}</span>
        <input value={form.reporterMobile} onChange={(e) => updateField('reporterMobile', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'رقم الهوية / الإقامة' : 'ID / Iqama Number'}</span>
        <input value={form.nationalIdOrIqama} onChange={(e) => updateField('nationalIdOrIqama', e.target.value)} />
      </label>
      <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}>
        <input type="checkbox" checked={form.consentToTerms} onChange={(e) => updateField('consentToTerms', e.target.checked)} />
        <span>{isArabic ? 'أوافق على الشروط والخصوصية' : 'I agree to terms and privacy.'}</span>
      </label>
    </div>
  );

  const renderOverviewStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}>
        <span>{isArabic ? 'رقم البلاغ' : 'Case Number'}</span>
        <input value={caseNumber} readOnly />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'تاريخ إدخال البلاغ' : 'Case Entry Date'}</span>
        <input type="date" value={form.caseEntryDate} onChange={(e) => updateField('caseEntryDate', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'طريقة استقبال البلاغ' : 'Case Source'}</span>
        <select value={form.caseSource} onChange={(e) => updateField('caseSource', e.target.value)}>
          {(isArabic ? ['الموقع', 'داخلي', 'أخرى'] : ['Website', 'Internal', 'Other']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      {mapValue(form.caseSource, maps.caseSource) === 'Other' ? (
        <label style={fieldStyle}>
          <span>{isArabic ? 'الرجاء التحديد' : 'Please specify'}</span>
          <input value={form.caseSourceOther} onChange={(e) => updateField('caseSourceOther', e.target.value)} />
        </label>
      ) : null}
      <label style={fieldStyle}>
        <span>{isArabic ? 'نوع البلاغ' : 'Case Type'}</span>
        <select value={form.caseType} onChange={(e) => updateField('caseType', e.target.value)}>
          {(isArabic ? ['احتيال مؤكد', 'اشتباه الاحتيال', 'مخالفة'] : ['Fraud Confirmed', 'Fraud Suspected', 'Violation']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'مستوى الأولوية' : 'Priority Level'}</span>
        <select value={form.priorityLevel} onChange={(e) => updateField('priorityLevel', e.target.value)}>
          {(isArabic ? ['عالية', 'متوسطة', 'منخفضة'] : ['High', 'Medium', 'Low']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'حالة البلاغ' : 'Case Status'}</span>
        <select value={form.caseStatus} onChange={(e) => updateField('caseStatus', e.target.value)}>
          {(isArabic ? ['مفتوح', 'معلق', 'مغلق'] : ['Open', 'Suspended', 'Closed']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      {mapValue(form.caseStatus, maps.status) === 'Closed' ? (
        <label style={fieldStyle}>
          <span>{isArabic ? 'سبب الإغلاق' : 'Closure Reason'}</span>
          <input value={form.closureReason} onChange={(e) => updateField('closureReason', e.target.value)} />
        </label>
      ) : null}
      {mapValue(form.caseStatus, maps.status) === 'Suspended' ? (
        <>
          <label style={fieldStyle}>
            <span>{isArabic ? 'تاريخ التعليق' : 'Suspension Date'}</span>
            <input type="date" value={form.suspensionDate} onChange={(e) => updateField('suspensionDate', e.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span>{isArabic ? 'مدة التعليق بالأيام' : 'Suspension Duration in Days'}</span>
            <input value={daysBetweenToday(form.suspensionDate)} readOnly />
          </label>
          <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <span>{isArabic ? 'سبب التعليق' : 'Suspension Reason'}</span>
            <input value={form.suspensionReason} onChange={(e) => updateField('suspensionReason', e.target.value)} />
          </label>
        </>
      ) : null}
      <label style={fieldStyle}>
        <span>{isArabic ? 'نوع التأمين' : 'Insurance Type'}</span>
        <select value={form.insuranceType} onChange={(e) => updateField('insuranceType', e.target.value)}>
          {(isArabic ? ['غير منطبق', 'مركبات', 'طبي', 'حياة', 'عام'] : ['Not Applicable', 'Motor', 'Medical', 'Life', 'General']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'المبلغ محل الاشتباه' : 'Suspected Amount'}</span>
        <input type="number" step="0.01" value={form.suspectedAmount} onChange={(e) => updateField('suspectedAmount', e.target.value)} />
      </label>
      <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}>
        <input type="checkbox" checked={form.hasClaim} onChange={() => updateField('hasClaim', !form.hasClaim)} />
        <span>{isArabic ? 'يوجد مطالبة مرتبطة بالبلاغ' : 'There is a related claim'}</span>
      </label>
      {form.hasClaim ? (
        <>
          <label style={fieldStyle}>
            <span>{isArabic ? 'رقم المطالبة' : 'Claim Number'}</span>
            <input value={form.claimNumber} onChange={(e) => updateField('claimNumber', e.target.value)} />
          </label>
          <label style={fieldStyle}>
            <span>{isArabic ? 'نوع المطالبة' : 'Claim Type'}</span>
            <input value={form.claimType} onChange={(e) => updateField('claimType', e.target.value)} />
          </label>
        </>
      ) : null}
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
        <span>{isArabic ? 'وصف البلاغ' : 'Case Description'}</span>
        <textarea rows={4} value={form.description} onChange={(e) => updateField('description', e.target.value)} />
      </label>
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
        <span>{isArabic ? 'ملاحظات وحدة مكافحة الاحتيال' : 'Fraud Unit Notes'}</span>
        <textarea rows={4} value={form.fraudUnitNotes} onChange={(e) => updateField('fraudUnitNotes', e.target.value)} />
      </label>
    </div>
  );

  const renderFraudIndicatorsStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}>
        <span>{isArabic ? 'تاريخ ثبوت الاحتيال' : 'Fraud Confirmed Date'}</span>
        <input type="date" value={form.fraudConfirmedDate} onChange={(e) => updateField('fraudConfirmedDate', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'آلية اكتشاف الاحتيال' : 'Fraud Detection Method'}</span>
        <input value={form.fraudDetectionMethod} onChange={(e) => updateField('fraudDetectionMethod', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'المبلغ المرتبط بالاحتيال' : 'Fraud Amount'}</span>
        <input type="number" step="0.01" value={form.fraudAmount} onChange={(e) => updateField('fraudAmount', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'الإجراء المتخذ' : 'Action Taken'}</span>
        <input value={form.actionTaken} onChange={(e) => updateField('actionTaken', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'الجهة المحالة لها' : 'Referred Entity'}</span>
        <input value={form.referredEntity} onChange={(e) => updateField('referredEntity', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'نوع مؤشر الاحتيال' : 'Fraud Indicator Type'}</span>
        <input value={form.fraudIndicatorType} onChange={(e) => updateField('fraudIndicatorType', e.target.value)} />
      </label>
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
        <span>{isArabic ? 'وصف المؤشر' : 'Indicator Description'}</span>
        <textarea rows={4} value={form.indicatorDescription} onChange={(e) => updateField('indicatorDescription', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'عدد مرات التكرار' : 'Occurrence Count'}</span>
        <input type="number" value={form.occurrenceCount} onChange={(e) => updateField('occurrenceCount', e.target.value)} />
      </label>
      <label style={fieldStyle}>
        <span>{isArabic ? 'درجة الخطورة' : 'Risk Level'}</span>
        <select value={form.riskLevel} onChange={(e) => updateField('riskLevel', e.target.value)}>
          {(isArabic ? ['عالية', 'متوسطة', 'منخفضة'] : ['High', 'Medium', 'Low']).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    </div>
  );

  const renderAttachmentsStep = () => (
    <div className="card form-grid single">
      <label style={fieldStyle}>
        <span>{isArabic ? 'المرفقات' : 'Attachments'}</span>
        <input type="file" multiple onChange={(event) => handleFiles(event.target.files)} />
      </label>
      {files.length === 0 ? <p className="muted">{isArabic ? 'لا توجد مرفقات بعد.' : 'No attachments yet.'}</p> : null}
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="actions-inline" style={{ justifyContent: 'space-between' }}>
          <span>{file.name}</span>
          <button type="button" className="mini-btn" onClick={() => removeFile(index)}>
            {isArabic ? 'إزالة' : 'Remove'}
          </button>
        </div>
      ))}
      <p className="muted">
        {isArabic
          ? 'سيتم رفع الملفات فعليًا إلى التخزين الآمن عند الحفظ كمسودة أو إرسال البلاغ.'
          : 'Files will be uploaded to secure storage when you save as draft or submit the case.'}
      </p>
    </div>
  );

  const renderActionLogStep = () => (
    <Table headers={[isArabic ? 'المسؤول' : 'Responsible', isArabic ? 'الحالة' : 'Status', isArabic ? 'التوقيت' : 'Time']}>
      <tr>
        <td>Admin</td>
        <td>{isArabic ? 'مسودة' : 'Draft'}</td>
        <td>{new Date().toLocaleString()}</td>
      </tr>
    </Table>
  );

  const renderCurrentStep = () => {
    if (currentStep === 'reporter') return renderReporterStep();
    if (currentStep === 'overview') return renderOverviewStep();
    if (currentStep === 'fraudIndicators') return renderFraudIndicatorsStep();
    if (currentStep === 'attachments') return renderAttachmentsStep();
    return renderActionLogStep();
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader title={t.title} subtitle={t.subtitle} eyebrow={isArabic ? 'مساحة العمل' : 'Workspace'} />

      <div className="card" style={{ marginBottom: 18, padding: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 18,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 22, color: '#1f2937' }}>
              {t.steps[currentStep]}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {stepHelperText}
            </p>
          </div>

          <div
            style={{
              minWidth: 90,
              borderRadius: 999,
              padding: '10px 14px',
              background: 'rgba(221, 244, 240, 0.9)',
              color: '#0d6c68',
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 12px 28px rgba(13, 108, 104, 0.12)',
            }}
          >
            {progressPercentage}%
          </div>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stepOrder.length}, minmax(155px, 1fr))`,
              minWidth: Math.max(stepOrder.length * 170, 760),
              alignItems: 'stretch',
            }}
          >
            {stepOrder.map((step, index) => {
              const isActive = step === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStep(step)}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '42px 1fr',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: 76,
                    padding: '10px 14px',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: isArabic ? 'right' : 'left',
                    color: isActive ? '#0d6c68' : '#374151',
                  }}
                >
                  {index < stepOrder.length - 1 ? (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 30,
                        left: 44,
                        right: -8,
                        height: 4,
                        borderRadius: 999,
                        background: isCompleted ? '#0d6c68' : 'rgba(148, 163, 184, 0.22)',
                      }}
                    />
                  ) : null}

                  <span
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isActive || isCompleted ? '#0d6c68' : '#eef2f7',
                      color: isActive || isCompleted ? '#ffffff' : '#64748b',
                      fontWeight: 900,
                      boxShadow: isActive ? '0 12px 24px rgba(13, 108, 104, 0.24)' : 'none',
                    }}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </span>

                  <span style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 14, lineHeight: 1.25 }}>
                      {t.steps[step]}
                    </strong>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {renderCurrentStep()}

      {submitError ? (
        <div className="card" style={{ marginTop: 16, color: '#b42318' }}>
          {submitError}
        </div>
      ) : null}

      <div className="actions-inline" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <button type="button" className="btn" onClick={goBack} disabled={currentStepIndex === 0}>
          {t.back}
        </button>
        {currentStepIndex < stepOrder.length - 1 ? (
          <button type="button" className="btn primary" onClick={goNext}>
            {t.next}
          </button>
        ) : (
          <div className="actions-inline" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => handleSubmit('Draft')} disabled={isSubmitting}>
              {isSubmitting ? t.submitting : t.saveDraft}
            </button>
            <button type="button" className="btn primary" onClick={() => handleSubmit('Selected')} disabled={isSubmitting}>
              {isSubmitting ? t.submitting : t.submit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
