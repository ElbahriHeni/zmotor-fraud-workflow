import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { API_URL, apiGet, apiPatch, apiUploadFormData, getAuthHeaders } from '../../api';
import type { AppLanguage, AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';


type WizardStep =
  | 'reporter'
  | 'overview'
  | 'fraudIndicators'
  | 'attachments'
  | 'actionLog';

type BackendFraudCase = {
  id: number;
  case_number: string;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_mobile: string | null;
  national_id_or_iqama: string | null;
  consent_to_terms_and_privacy?: boolean | null;

  claim_id: string | null;
  case_type: string | null;
  case_source: string | null;
  case_source_other?: string | null;
  priority_level: string | null;
  case_status: string | null;
  case_entry_date: string | null;
  insurance_type: string | null;
  suspected_amount: string | null;
  description: string | null;
  has_claim?: boolean | null;

  claim_type: string | null;
  suspension_date?: string | null;
  suspension_reason?: string | null;

  fraud_confirmed_date: string | null;
  fraud_detection_method: string | null;
  fraud_amount: string | null;
  action_taken: string | null;
  referred_entity: string | null;
  fraud_indicator_type: string | null;
  indicator_description: string | null;
  occurrence_count: number | null;
  risk_level?: string | null;

  assigned_user: string | null;
  assignment_date: string | null;
  assigned_by: string | null;
  reassignment_reason: string | null;
  fraud_unit_notes: string | null;
  closure_date: string | null;
  closure_reason: string | null;
};

type BackendDocument = {
  id: number;
  file_name: string;
  file_type: string | null;
  file_url: string | null;
  storage_path?: string | null;
  category: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
};

type BackendActionLog = {
  id: number;
  responsible_user: string | null;
  status: string | null;
  action_type?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  details?: string | null;
  action_time: string | null;
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

const maps = {
  caseSource: { الموقع: 'Website', داخلي: 'Internal', أخرى: 'Other', Website: 'Website', Internal: 'Internal', Other: 'Other' },
  caseType: {
    'احتيال مؤكد': 'Fraud Confirmed',
    'اشتباه الاحتيال': 'Fraud Suspected',
    مخالفة: 'Violation',
    'Fraud Confirmed': 'Fraud Confirmed',
    'Fraud Suspected': 'Fraud Suspected',
    Violation: 'Violation',
  },
  priority: { عالية: 'High', متوسطة: 'Medium', منخفضة: 'Low', High: 'High', Medium: 'Medium', Low: 'Low' },
  insurance: { مركبات: 'Motor', طبي: 'Medical', حياة: 'Life', عام: 'General', 'غير منطبق': 'Not Applicable', Motor: 'Motor', Medical: 'Medical', Life: 'Life', General: 'General', 'Not Applicable': 'Not Applicable' },
  risk: { عالية: 'High', متوسطة: 'Medium', منخفضة: 'Low', High: 'High', Medium: 'Medium', Low: 'Low' },
  status: { مفتوح: 'Open', معلق: 'Suspended', مغلق: 'Closed', Open: 'Open', Suspended: 'Suspended', Closed: 'Closed' },
} as const;

const reverseMaps = {
  caseSource: { Website: 'الموقع', Internal: 'داخلي', Other: 'أخرى' },
  caseType: { 'Fraud Confirmed': 'احتيال مؤكد', 'Fraud Suspected': 'اشتباه الاحتيال', Violation: 'مخالفة' },
  priority: { High: 'عالية', Medium: 'متوسطة', Low: 'منخفضة' },
  insurance: { Motor: 'مركبات', Medical: 'طبي', Life: 'حياة', General: 'عام', 'Not Applicable': 'غير منطبق' },
  risk: { High: 'عالية', Medium: 'متوسطة', Low: 'منخفضة' },
  status: { Draft: 'مسودة', Received: 'مستلم', Open: 'مفتوح', Suspended: 'معلق', Closed: 'مغلق', Reassigned: 'إعادة التعيين' },
} as const;

const ALLOWED_ATTACHMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.txt'];
const MAX_ATTACHMENT_SIZE_MB = 15;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

function formatAllowedExtensions() {
  return ALLOWED_ATTACHMENT_EXTENSIONS.join(', ');
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : '';
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
    } catch {
      return utf8Match[1].replace(/"/g, '');
    }
  }

  const normalMatch = disposition.match(/filename="?([^";]+)"?/i);
  return normalMatch?.[1] || fallback;
}


const copy = {
  en: {
    title: 'Case Details',
    subtitle: 'Review and update the fraud case using the guided case workflow.',
    titleNew: 'New Case',
    save: 'Save Changes',
    saving: 'Saving...',
    saved: 'Changes saved successfully.',
    error: 'Could not save changes to backend.',
    attachmentTooLarge: `The selected file is too large. Maximum allowed file size is ${MAX_ATTACHMENT_SIZE_MB} MB.`,
    attachmentTypeNotAllowed: `File type is not allowed. Allowed file types: ${formatAllowedExtensions()}.`,
    attachmentValidationIntro: `Allowed file types: ${formatAllowedExtensions()}. Maximum file size: ${MAX_ATTACHMENT_SIZE_MB} MB.`,
    loading: 'Loading case details from backend...',
    notFound: 'Case not found.',
    next: 'Next',
    back: 'Back',
    queue: 'Back to Queue',
    steps: {
      reporter: 'Reporter Details',
      overview: 'Case Overview',
      fraudIndicators: 'Fraud Indicators',
      attachments: 'Attachments',
      actionLog: 'Action Log',
    },
  },
  ar: {
    title: 'تفاصيل البلاغ',
    subtitle: 'مراجعة وتحديث البلاغ باستخدام مسار عمل واضح ومبسط.',
    titleNew: 'بلاغ جديد',
    save: 'حفظ التغييرات',
    saving: 'جاري الحفظ...',
    saved: 'تم حفظ التغييرات بنجاح.',
    error: 'تعذر حفظ التغييرات في الخادم.',
    attachmentTooLarge: `حجم الملف المحدد كبير جدًا. الحد الأقصى المسموح به هو ${MAX_ATTACHMENT_SIZE_MB} ميجابايت.`,
    attachmentTypeNotAllowed: `نوع الملف غير مسموح. الأنواع المسموحة: ${formatAllowedExtensions()}.`,
    attachmentValidationIntro: `الأنواع المسموحة: ${formatAllowedExtensions()}. الحد الأقصى لحجم الملف: ${MAX_ATTACHMENT_SIZE_MB} ميجابايت.`,
    loading: 'جاري تحميل تفاصيل البلاغ من الخادم...',
    notFound: 'لم يتم العثور على البلاغ.',
    next: 'التالي',
    back: 'السابق',
    queue: 'العودة إلى قائمة البلاغات',
    steps: {
      reporter: 'بيانات المبلّغ',
      overview: 'نظرة عامة على البلاغ',
      fraudIndicators: 'مؤشرات الاحتيال',
      attachments: 'المرفقات',
      actionLog: 'سجل الإجراءات',
    },
  },
};

const emptyForm: FormState = {
  reporterName: '',
  reporterEmail: '',
  reporterMobile: '',
  nationalIdOrIqama: '',
  consentToTerms: false,

  caseEntryDate: '',
  caseSource: 'Website',
  caseSourceOther: '',
  caseType: 'Fraud Suspected',
  priorityLevel: 'Medium',
  caseStatus: 'Draft',
  insuranceType: 'Not Applicable',
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
  riskLevel: 'Medium',

  fraudUnitNotes: '',
  closureReason: '',
};

const mapValue = (value: string, mapping: Record<string, string>) => mapping[value] ?? value;
const formatDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');
const formatDateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '-');

const daysBetweenToday = (dateValue: string) => {
  if (!dateValue) return '';
  const start = new Date(`${dateValue}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime())) return '';
  return String(Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
};

function mapCaseToForm(data: BackendFraudCase, isArabic: boolean): FormState {
  const translate = <T extends Record<string, string>>(value: string | null | undefined, map: T, fallback: string) => {
    if (!value) return fallback;
    return isArabic ? map[value as keyof T] ?? value : value;
  };

  return {
    reporterName: data.reporter_name ?? '',
    reporterEmail: data.reporter_email ?? '',
    reporterMobile: data.reporter_mobile ?? '',
    nationalIdOrIqama: data.national_id_or_iqama ?? '',
    consentToTerms: Boolean(data.consent_to_terms_and_privacy),

    caseEntryDate: formatDateInput(data.case_entry_date),
    caseSource: translate(data.case_source, reverseMaps.caseSource, isArabic ? 'الموقع' : 'Website'),
    caseSourceOther: data.case_source_other ?? '',
    caseType: translate(data.case_type, reverseMaps.caseType, isArabic ? 'اشتباه الاحتيال' : 'Fraud Suspected'),
    priorityLevel: translate(data.priority_level, reverseMaps.priority, isArabic ? 'متوسطة' : 'Medium'),
    caseStatus: isArabic ? reverseMaps.status[data.case_status as keyof typeof reverseMaps.status] ?? data.case_status ?? '' : data.case_status ?? '',
    insuranceType: translate(data.insurance_type, reverseMaps.insurance, isArabic ? 'غير منطبق' : 'Not Applicable'),
    hasClaim: Boolean(data.has_claim),
    description: data.description ?? '',
    suspectedAmount: data.suspected_amount ?? '',

    claimNumber: data.claim_id ?? '',
    claimType: data.claim_type ?? '',
    suspensionDate: formatDateInput(data.suspension_date),
    suspensionReason: data.suspension_reason ?? '',

    fraudConfirmedDate: formatDateInput(data.fraud_confirmed_date),
    fraudDetectionMethod: data.fraud_detection_method ?? '',
    fraudAmount: data.fraud_amount ?? '',
    actionTaken: data.action_taken ?? '',
    referredEntity: data.referred_entity ?? '',
    fraudIndicatorType: data.fraud_indicator_type ?? '',
    indicatorDescription: data.indicator_description ?? '',
    occurrenceCount: data.occurrence_count === null || data.occurrence_count === undefined ? '' : String(data.occurrence_count),
    riskLevel: translate(data.risk_level, reverseMaps.risk, isArabic ? 'متوسطة' : 'Medium'),

    fraudUnitNotes: data.fraud_unit_notes ?? '',
    closureReason: data.closure_reason ?? '',
  };
}

export default function CaseDetailsPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const t = copy[language];
  const canUpdateCases = hasPermission(currentUser, 'cases.update');
  const canChangeStatus = hasPermission(currentUser, 'cases.change_status');
  const canUploadDocuments = hasPermission(currentUser, 'cases.upload_documents');
  const canDownloadDocuments = hasPermission(currentUser, 'cases.download_documents');
  const canExportPdf = hasPermission(currentUser, 'cases.export_pdf');

  const downloadFromBackend = async (url: string, fallbackFileName: string) => {
    try {
      setError('');
      setMessage('');

      const response = await fetch(url, {
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        let errorMessage = isArabic ? 'تعذر تحميل الملف.' : 'Could not download the file.';

        try {
          const errorBody = await response.json();
          errorMessage = isArabic
            ? errorBody?.message_ar || errorBody?.message || errorMessage
            : errorBody?.message || errorBody?.error || errorMessage;
        } catch {
          // Keep default error.
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const fileName = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fallbackFileName);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : isArabic ? 'تعذر تحميل الملف.' : 'Could not download the file.');
    }
  };

  const handleExportPdf = () => {
    if (!caseData?.case_number) return;
    downloadFromBackend(`${API_URL}/api/cases/${caseData.case_number}/export-pdf`, `${caseData.case_number}.pdf`);
  };

  const [currentStep, setCurrentStep] = useState<WizardStep>('reporter');
  const [caseData, setCaseData] = useState<BackendFraudCase | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [actionLog, setActionLog] = useState<BackendActionLog[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalizedCaseType = mapValue(form.caseType, maps.caseType);
  const showFraudIndicators = normalizedCaseType === 'Fraud Confirmed' || normalizedCaseType === 'Fraud Suspected';
  const normalizedCaseStatus = mapValue(form.caseStatus, maps.status); 
  const isClosedCase = normalizedCaseStatus === 'Closed';
  const isCurrentStepLocked = isClosedCase && currentStep !== 'overview' && currentStep !== 'actionLog';


  const stepOrder = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = ['reporter', 'overview'];
    if (showFraudIndicators) steps.push('fraudIndicators');
    steps.push('attachments', 'actionLog');
    return steps;
  }, [showFraudIndicators]);

  const currentStepIndex = stepOrder.indexOf(currentStep);
  const progressPercentage = Math.round(((currentStepIndex + 1) / stepOrder.length) * 100);

  const stepHelperText = isClosedCase
    ? isArabic
      ? 'هذا البلاغ مغلق. انتقل إلى نظرة عامة وغيّر الحالة إلى مفتوح لإعادة التعديل.'
      : 'This case is closed. Go to Case Overview and change the status to Open to edit it again.'
    : isArabic
      ? 'تنقّل بين الخطوات ثم احفظ التغييرات عند الانتهاء.'
      : 'Move between the steps, then save your changes when finished.';

  useEffect(() => {
    let isMounted = true;

    async function loadCase() {
      if (!caseId) return;
      try {
        setIsLoading(true);
        setError('');
        const data = await apiGet<BackendFraudCase>(`/api/cases/${caseId}`);
        if (!isMounted) return;
        setCaseData(data);
        setForm(mapCaseToForm(data, isArabic));
      } catch (loadError) {
        if (isMounted) setError(t.notFound);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCase();

    return () => {
      isMounted = false;
    };
  }, [caseId, isArabic, t.notFound]);

  useEffect(() => {
    async function loadOptionalData() {
      if (!caseId) return;
      if (currentStep === 'attachments' && canDownloadDocuments) {
        try {
          const data = await apiGet<BackendDocument[]>(`/api/cases/${caseId}/documents`);
          setDocuments(data);
        } catch {
          setDocuments([]);
        }
      }
      if (currentStep === 'actionLog') {
        try {
          const data = await apiGet<BackendActionLog[]>(`/api/cases/${caseId}/action-log`);
          setActionLog(data);
        } catch {
          setActionLog([]);
        }
      }
    }

    loadOptionalData();
  }, [caseId, currentStep, canDownloadDocuments]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateAttachmentFiles = (selectedFiles: File[]) => {
    for (const file of selectedFiles) {
      const extension = getFileExtension(file.name);

      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        return `${file.name}: ${t.attachmentTypeNotAllowed}`;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return `${file.name}: ${t.attachmentTooLarge}`;
      }
    }

    return '';
  };

  const handleAttachmentSelection = (selectedFileList: FileList | null) => {
    const selectedFiles = selectedFileList ? Array.from(selectedFileList) : [];
    const validationError = validateAttachmentFiles(selectedFiles);

    if (validationError) {
      setFiles([]);
      setMessage('');
      setError(validationError);
      return;
    }

    setError('');
    setFiles(selectedFiles);
  };

  const goNext = () => {
    if (currentStepIndex < stepOrder.length - 1) setCurrentStep(stepOrder[currentStepIndex + 1]);
  };

  const goBack = () => {
    if (currentStepIndex > 0) setCurrentStep(stepOrder[currentStepIndex - 1]);
  };

  const reloadCase = async () => {
    if (!caseId) return;
    const data = await apiGet<BackendFraudCase>(`/api/cases/${caseId}`);
    setCaseData(data);
    setForm(mapCaseToForm(data, isArabic));
  };

  const uploadCaseDocument = async (file: File) => {
    if (!caseId) return;

    const validationError = validateAttachmentFiles([file]);
    if (validationError) {
      throw new Error(validationError);
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('category', 'supporting_document');
    formData.append('uploaded_by', currentUser?.email || 'System');

    return apiUploadFormData(`/api/cases/${caseId}/upload-document`, formData);
  };

  const handleSave = async () => {
    if (!caseId || !caseData) return;
    try {
      setIsSaving(true);
      setError('');
      setMessage('');

      if (currentStep === 'reporter') {
        await apiPatch(`/api/cases/${caseId}/reporter`, {
          reporter_name: form.reporterName,
          reporter_email: form.reporterEmail,
          reporter_mobile: form.reporterMobile,
          national_id_or_iqama: form.nationalIdOrIqama,
          consent_to_terms_and_privacy: form.consentToTerms,
        });
      }

      if (currentStep === 'overview') {
        const selectedStatus = mapValue(form.caseStatus, maps.status);
        const storedStatus = mapValue(caseData.case_status || '', maps.status);
        const closureReasonChanged = selectedStatus === 'Closed' && form.closureReason !== (caseData.closure_reason || '');
        const suspensionChanged =
          selectedStatus === 'Suspended' &&
          (form.suspensionDate !== formatDateInput(caseData.suspension_date) ||
            form.suspensionReason !== (caseData.suspension_reason || ''));

        if (selectedStatus === 'Closed' && !form.closureReason.trim()) {
          throw new Error(isArabic ? 'سبب الإغلاق مطلوب عند إغلاق البلاغ.' : 'Closure reason is required when closing a case.');
        }

        if (selectedStatus === 'Suspended' && (!form.suspensionDate || !form.suspensionReason.trim())) {
          throw new Error(
            isArabic
              ? 'تاريخ التعليق وسبب التعليق مطلوبان عند تعليق البلاغ.'
              : 'Suspension date and suspension reason are required when suspending a case.'
          );
        }

        await apiPatch(`/api/cases/${caseId}/overview`, {
          case_entry_date: form.caseEntryDate,
          case_source: mapValue(form.caseSource, maps.caseSource),
          case_source_other: form.caseSourceOther,
          case_type: mapValue(form.caseType, maps.caseType),
          priority_level: mapValue(form.priorityLevel, maps.priority),
          insurance_type: mapValue(form.insuranceType, maps.insurance),
          has_claim: form.hasClaim,
          claim_id: form.hasClaim ? form.claimNumber : null,
          claim_type: form.hasClaim ? form.claimType : null,
          suspected_amount: Number(form.suspectedAmount || 0),
          description: form.description,
          fraud_unit_notes: form.fraudUnitNotes,
        });

        if (selectedStatus !== storedStatus || closureReasonChanged || suspensionChanged) {
          await apiPatch(`/api/cases/${caseId}/status`, {
            case_status: selectedStatus,
            closure_reason: selectedStatus === 'Closed' ? form.closureReason : '',
            suspension_date: selectedStatus === 'Suspended' ? form.suspensionDate : null,
            suspension_reason: selectedStatus === 'Suspended' ? form.suspensionReason : '',
            responsible_user: currentUser?.email || 'System',
          });
        }
      }


      if (currentStep === 'fraudIndicators') {
        await apiPatch(`/api/cases/${caseId}/indicators`, {
          fraud_confirmed_date: form.fraudConfirmedDate || null,
          fraud_detection_method: form.fraudDetectionMethod,
          fraud_amount: Number(form.fraudAmount || 0),
          action_taken: form.actionTaken,
          referred_entity: form.referredEntity,
          fraud_indicator_type: form.fraudIndicatorType,
          indicator_description: form.indicatorDescription,
          occurrence_count: Number(form.occurrenceCount || 0),
          risk_level: mapValue(form.riskLevel, maps.risk),
        });
      }

      if (currentStep === 'attachments' && canDownloadDocuments) {
        for (const file of files) {
          await uploadCaseDocument(file);
        }

        if (files.length > 0) {
          const latestDocuments = await apiGet<BackendDocument[]>(`/api/cases/${caseId}/documents`);
          setDocuments(latestDocuments);
        }

        setFiles([]);
      }

      await reloadCase();
      setMessage(t.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.error);
    } finally {
      setIsSaving(false);
    }
  };

  const fieldStyle = { display: 'grid', gap: 8 };

  if (isLoading) {
    return <div className="card">{t.loading}</div>;
  }

  if (!caseData) {
    return <div className="card">{error || t.notFound}</div>;
  }

  const renderReporterStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}><span>{isArabic ? 'اسم المبلّغ' : 'Reporter Name'}</span><input value={form.reporterName} onChange={(e) => updateField('reporterName', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'البريد الإلكتروني' : 'Email'}</span><input value={form.reporterEmail} onChange={(e) => updateField('reporterEmail', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'رقم الجوال' : 'Mobile Number'}</span><input value={form.reporterMobile} onChange={(e) => updateField('reporterMobile', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'رقم الهوية / الإقامة' : 'ID / Iqama Number'}</span><input value={form.nationalIdOrIqama} onChange={(e) => updateField('nationalIdOrIqama', e.target.value)} /></label>
    </div>
  );

  const renderOverviewStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}><span>{isArabic ? 'رقم البلاغ' : 'Case Number'}</span><input value={caseData.case_number} readOnly /></label>
      <label style={fieldStyle}><span>{isArabic ? 'تاريخ إدخال البلاغ' : 'Case Entry Date'}</span><input type="date" value={form.caseEntryDate} onChange={(e) => updateField('caseEntryDate', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'طريقة استقبال البلاغ' : 'Case Source'}</span><select value={form.caseSource} onChange={(e) => updateField('caseSource', e.target.value)}>{(isArabic ? ['الموقع', 'داخلي', 'أخرى'] : ['Website', 'Internal', 'Other']).map((option) => <option key={option}>{option}</option>)}</select></label>
      {mapValue(form.caseSource, maps.caseSource) === 'Other' ? <label style={fieldStyle}><span>{isArabic ? 'الرجاء التحديد' : 'Please specify'}</span><input value={form.caseSourceOther} onChange={(e) => updateField('caseSourceOther', e.target.value)} /></label> : null}
      <label style={fieldStyle}><span>{isArabic ? 'نوع البلاغ' : 'Case Type'}</span><select value={form.caseType} onChange={(e) => updateField('caseType', e.target.value)}>{(isArabic ? ['احتيال مؤكد', 'اشتباه الاحتيال', 'مخالفة'] : ['Fraud Confirmed', 'Fraud Suspected', 'Violation']).map((option) => <option key={option}>{option}</option>)}</select></label>
      <label style={fieldStyle}><span>{isArabic ? 'مستوى الأولوية' : 'Priority Level'}</span><select value={form.priorityLevel} onChange={(e) => updateField('priorityLevel', e.target.value)}>{(isArabic ? ['عالية', 'متوسطة', 'منخفضة'] : ['High', 'Medium', 'Low']).map((option) => <option key={option}>{option}</option>)}</select></label>
      <label style={fieldStyle}><span>{isArabic ? 'حالة البلاغ' : 'Case Status'}</span><select disabled={!canChangeStatus} value={form.caseStatus} onChange={(e) => updateField('caseStatus', e.target.value)}>{!['Open', 'Suspended', 'Closed'].includes(normalizedCaseStatus) ? <option value={form.caseStatus} disabled>{form.caseStatus}</option> : null}{(isArabic ? ['مفتوح', 'معلق', 'مغلق'] : ['Open', 'Suspended', 'Closed']).map((option) => <option key={option}>{option}</option>)}</select></label>
      {mapValue(form.caseStatus, maps.status) === 'Closed' ? <label style={fieldStyle}><span>{isArabic ? 'سبب الإغلاق' : 'Closure Reason'}</span><input value={form.closureReason} onChange={(e) => updateField('closureReason', e.target.value)} /></label> : null}
      {mapValue(form.caseStatus, maps.status) === 'Suspended' ? <>
        <label style={fieldStyle}><span>{isArabic ? 'تاريخ التعليق' : 'Suspension Date'}</span><input type="date" value={form.suspensionDate} onChange={(e) => updateField('suspensionDate', e.target.value)} /></label>
        <label style={fieldStyle}><span>{isArabic ? 'مدة التعليق بالأيام' : 'Suspension Duration in Days'}</span><input value={daysBetweenToday(form.suspensionDate)} readOnly /></label>
        <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}><span>{isArabic ? 'سبب التعليق' : 'Suspension Reason'}</span><input value={form.suspensionReason} onChange={(e) => updateField('suspensionReason', e.target.value)} /></label>
      </> : null}
      <label style={fieldStyle}><span>{isArabic ? 'نوع التأمين' : 'Insurance Type'}</span><select value={form.insuranceType} onChange={(e) => updateField('insuranceType', e.target.value)}>{(isArabic ? ['غير منطبق', 'مركبات', 'طبي', 'حياة', 'عام'] : ['Not Applicable', 'Motor', 'Medical', 'Life', 'General']).map((option) => <option key={option}>{option}</option>)}</select></label>
      <label style={fieldStyle}><span>{isArabic ? 'المبلغ محل الاشتباه' : 'Suspected Amount'}</span><input type="number" value={form.suspectedAmount} onChange={(e) => updateField('suspectedAmount', e.target.value)} /></label>
      <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.hasClaim} onChange={() => updateField('hasClaim', !form.hasClaim)} /><span>{isArabic ? 'يوجد مطالبة مرتبطة بالبلاغ' : 'There is a related claim'}</span></label>
      {form.hasClaim ? <>
        <label style={fieldStyle}><span>{isArabic ? 'رقم المطالبة' : 'Claim Number'}</span><input value={form.claimNumber} onChange={(e) => updateField('claimNumber', e.target.value)} /></label>
        <label style={fieldStyle}><span>{isArabic ? 'نوع المطالبة' : 'Claim Type'}</span><input value={form.claimType} onChange={(e) => updateField('claimType', e.target.value)} /></label>
      </> : null}
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}><span>{isArabic ? 'وصف البلاغ' : 'Description'}</span><textarea rows={4} value={form.description} onChange={(e) => updateField('description', e.target.value)} /></label>
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}><span>{isArabic ? 'ملاحظات وحدة مكافحة الاحتيال' : 'Fraud Unit Notes'}</span><textarea rows={4} value={form.fraudUnitNotes} onChange={(e) => updateField('fraudUnitNotes', e.target.value)} /></label>
    </div>
  );

  const renderFraudIndicatorsStep = () => (
    <div className="card form-grid two-col-form">
      <label style={fieldStyle}><span>{isArabic ? 'تاريخ ثبوت الاحتيال' : 'Fraud Confirmed Date'}</span><input type="date" value={form.fraudConfirmedDate} onChange={(e) => updateField('fraudConfirmedDate', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'آلية اكتشاف الاحتيال' : 'Fraud Detection Method'}</span><input value={form.fraudDetectionMethod} onChange={(e) => updateField('fraudDetectionMethod', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'المبلغ المرتبط بالاحتيال' : 'Fraud Amount'}</span><input type="number" value={form.fraudAmount} onChange={(e) => updateField('fraudAmount', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'الإجراء المتخذ' : 'Action Taken'}</span><input value={form.actionTaken} onChange={(e) => updateField('actionTaken', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'الجهة المحالة لها' : 'Referred Entity'}</span><input value={form.referredEntity} onChange={(e) => updateField('referredEntity', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'نوع مؤشر الاحتيال' : 'Fraud Indicator Type'}</span><input value={form.fraudIndicatorType} onChange={(e) => updateField('fraudIndicatorType', e.target.value)} /></label>
      <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}><span>{isArabic ? 'وصف المؤشر' : 'Indicator Description'}</span><textarea rows={4} value={form.indicatorDescription} onChange={(e) => updateField('indicatorDescription', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'عدد مرات التكرار' : 'Occurrence Count'}</span><input type="number" value={form.occurrenceCount} onChange={(e) => updateField('occurrenceCount', e.target.value)} /></label>
      <label style={fieldStyle}><span>{isArabic ? 'درجة الخطورة' : 'Risk Level'}</span><select value={form.riskLevel} onChange={(e) => updateField('riskLevel', e.target.value)}>{(isArabic ? ['عالية', 'متوسطة', 'منخفضة'] : ['High', 'Medium', 'Low']).map((option) => <option key={option}>{option}</option>)}</select></label>
    </div>
  );

  const renderAttachmentsStep = () => (
    <div className="card form-grid single">
      <label style={fieldStyle}>
        <span>{isArabic ? 'إضافة مرفقات' : 'Add Attachments'}</span>
        <input
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(',')}
          disabled={!canUploadDocuments}
          onChange={(event) => handleAttachmentSelection(event.target.files)}
        />
      </label>
      <p className="muted" style={{ marginTop: -8 }}>{t.attachmentValidationIntro}</p>
      {documents.length === 0 ? <p className="muted">{isArabic ? 'لا توجد مرفقات محفوظة.' : 'No saved attachments.'}</p> : null}
      {documents.map((doc) => (
        <div key={doc.id} className="card">
          <strong>{doc.file_name}</strong>
          <p className="muted">{doc.file_type || '-'} • {formatDateTime(doc.uploaded_at)}</p>
          {canDownloadDocuments ? <button
            className="text-link"
            type="button"
            onClick={() => downloadFromBackend(`${API_URL}/api/documents/${doc.id}/download`, doc.file_name || 'attachment')}
          >
            {isArabic ? 'تحميل المرفق' : 'Download attachment'}
          </button> : null}
        </div>
      ))}
      {files.map((file) => <p key={file.name}>{file.name}</p>)}
    </div>
  );

  const renderActionLogStep = () => (
    <Table headers={[
      isArabic ? 'الإجراء' : 'Action',
      isArabic ? 'الحالة السابقة' : 'Previous Status',
      isArabic ? 'الحالة الجديدة' : 'New Status',
      isArabic ? 'المسؤول' : 'Responsible',
      isArabic ? 'التوقيت' : 'Time',
    ]}>
      {actionLog.length > 0 ? actionLog.map((item) => {
        const actionType = item.action_type || 'CASE_UPDATED';
        const isStatusAction = ['CASE_CREATED', 'CASE_STATUS_CHANGED', 'STATUS_CHANGED'].includes(actionType);

        return (
          <tr key={item.id}>
            <td>{actionType}</td>
            <td>{isStatusAction ? item.previous_status || '-' : '-'}</td>
            <td>{isStatusAction ? item.new_status || item.status || '-' : '-'}</td>
            <td>{item.responsible_user || '-'}</td>
            <td>{formatDateTime(item.action_time)}</td>
          </tr>
        );
      }) : <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>{isArabic ? 'لا يوجد سجل إجراءات بعد.' : 'No action log yet.'}</td></tr>}
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
      <PageHeader
        title={`${t.title} - ${caseData.case_number}`}
        subtitle={t.subtitle}
        action={
          <div className="actions-inline" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => navigate('/app/queue')}>{t.queue}</button>
            {canExportPdf ? <button className="btn primary" onClick={handleExportPdf}>{isArabic ? 'تصدير PDF' : 'Export PDF'}</button> : null}
          </div>
        }
      />

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

      {isCurrentStepLocked ? (
        <div className="card" style={{ marginBottom: 16, color: '#92400e', background: '#fff7ed' }}>
          {isArabic
            ? 'هذا البلاغ مغلق. يمكنك فتحه مجددًا من خطوة نظرة عامة عبر تغيير حالة البلاغ إلى مفتوح.'
            : 'This case is closed. Reopen it from Case Overview by changing Case Status to Open.'}
        </div>
      ) : null}

      <fieldset disabled={isCurrentStepLocked || (currentStep !== 'attachments' && currentStep !== 'actionLog' && !canUpdateCases)} style={{ border: 0, padding: 0, margin: 0 }}>
        {renderCurrentStep()}
      </fieldset>

      {message ? <div className="card" style={{ marginTop: 16, color: '#027a48' }}>{message}</div> : null}
      {error ? <div className="card" style={{ marginTop: 16, color: '#b42318' }}>{error}</div> : null}

      <div className="actions-inline" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <button type="button" className="btn" onClick={goBack} disabled={currentStepIndex === 0}>{t.back}</button>
        <div className="actions-inline">
          {currentStep !== 'actionLog' && (currentStep === 'attachments' ? canUploadDocuments : canUpdateCases) ? <button type="button" className="btn primary" onClick={handleSave} disabled={isSaving || isCurrentStepLocked}>{isSaving ? t.saving : t.save}</button> : null}
          {currentStepIndex < stepOrder.length - 1 ? <button type="button" className="btn" onClick={goNext}>{t.next}</button> : null}
        </div>
      </div>
    </div>
  );
}
