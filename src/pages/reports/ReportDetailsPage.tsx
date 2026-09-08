import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiGet } from '../../api';
import type { AppLanguage, AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';

type ReportKey =
  | 'fraudCases'
  | 'confirmedFraud'
  | 'fraudIndicators'
  | 'suspendedFraud'
  | 'fraudPerformance';

type ReportRow = {
  case_id?: string | null;
  claim_id?: string | null;
  case_entry_date?: string | null;
  case_source?: string | null;
  case_type?: string | null;
  priority_level?: string | null;
  case_status?: string | null;
  fraud_unit_notes?: string | null;
  closure_date?: string | null;
  closure_reason?: string | null;
  suspected_amount?: string | number | null;
  insurance_type?: string | null;

  claim_type?: string | null;
  fraud_confirmed_date?: string | null;
  fraud_detection_method?: string | null;
  fraud_amount?: string | number | null;
  action_taken?: string | null;
  referred_entity?: string | null;

  fraud_indicator_type?: string | null;
  indicator_description?: string | null;
  occurrence_count?: string | number | null;
  risk_level?: string | null;
  system_recommendation?: string | null;

  suspension_date?: string | null;
  suspension_reason?: string | null;
  assigned_user?: string | null;

  open_time?: string | null;
  close_time?: string | null;
};

type FiltersState = {
  caseId: string;
  claimId: string;
  caseSource: string;
  caseType: string;
  priorityLevel: string;
  caseStatus: string;
  insuranceType: string;
  startDate: string;
  endDate: string;
};

type ReportPageCopy = {
  eyebrow: string;
  previewSubtitle: string;
  confirmedFraudSubtitle: string;
  fraudIndicatorsSubtitle: string;
  suspendedFraudSubtitle: string;
  fraudPerformanceSubtitle: string;
  exportExcel: string;
  resetFilters: string;
  loading: string;
  error: string;
  confirmedFraudError: string;
  fraudIndicatorsError: string;
  suspendedFraudError: string;
  fraudPerformanceError: string;
  noRows: string;
  filterCaseId: string;
  filterClaimId: string;
  allCaseSources: string;
  allCaseTypes: string;
  allPriorities: string;
  allStatuses: string;
  allInsuranceTypes: string;
  startDate: string;
  endDate: string;

  caseId: string;
  claimId: string;
  caseEntryDate: string;
  caseSource: string;
  caseType: string;
  priorityLevel: string;
  caseStatus: string;
  fraudUnitNotes: string;
  closureDate: string;
  closureReason: string;
  suspectedAmount: string;
  insuranceType: string;

  claimType: string;
  fraudConfirmedDate: string;
  fraudDetectionMethod: string;
  fraudAmount: string;
  actionTaken: string;
  referredEntity: string;

  fraudIndicatorType: string;
  indicatorDescription: string;
  occurrenceCount: string;
  riskLevel: string;
  systemRecommendation: string;

  suspensionDate: string;
  suspensionReason: string;
  suspensionDuration: string;
  currentStatus: string;
  responsibleEmployee: string;

  metric: string;
  value: string;
  totalCasesCount: string;
  closedCasesCount: string;
  openCasesCount: string;
  averageProcessingTime: string;
  mostRepeatedFraudType: string;
  totalFraudAmount: string;
  notCalculatedYet: string;

  website: string;
  internal: string;
  other: string;
  fraudConfirmedType: string;
  fraudSuspected: string;
  violation: string;
  high: string;
  medium: string;
  low: string;
  open: string;
  suspended: string;
  closed: string;
  motor: string;
  medical: string;
  life: string;
  general: string;
  notApplicable: string;
  day: string;
  days: string;
  hour: string;
  hours: string;
  minute: string;
  minutes: string;
  reportTitles: Record<ReportKey, string>;
};

const pageCopy: Record<AppLanguage, ReportPageCopy> = {
  en: {
    eyebrow: 'Report',
    previewSubtitle: 'All submitted fraud cases excluding draft cases.',
    confirmedFraudSubtitle: 'Confirmed fraud cases only. Draft cases are excluded.',
    fraudIndicatorsSubtitle: 'Fraud confirmed and suspected fraud cases only. Draft cases are excluded.',
    suspendedFraudSubtitle: 'Fraud cases currently in Suspended status. Draft cases are excluded.',
    fraudPerformanceSubtitle: 'Fraud unit performance summary for all non-draft cases.',
    exportExcel: 'Export Excel',
    resetFilters: 'Reset Filters',
    loading: 'Loading report data...',
    error: 'Could not load fraud cases report from backend.',
    confirmedFraudError: 'Could not load confirmed fraud report from backend.',
    fraudIndicatorsError: 'Could not load fraud indicators report from backend.',
    suspendedFraudError: 'Could not load suspended fraud report from backend.',
    fraudPerformanceError: 'Could not load fraud performance report from backend.',
    noRows: 'No matching cases found.',
    filterCaseId: 'Filter Case Id',
    filterClaimId: 'Filter Claim Id',
    allCaseSources: 'All Case Sources',
    allCaseTypes: 'All Case Types',
    allPriorities: 'All Priorities',
    allStatuses: 'All Statuses',
    allInsuranceTypes: 'All Insurance Types',
    startDate: 'Start Date',
    endDate: 'End Date',

    caseId: 'Case Id',
    claimId: 'Claim Id',
    caseEntryDate: 'Case Entry Date',
    caseSource: 'Case Source',
    caseType: 'Case Type',
    priorityLevel: 'Priority Level',
    caseStatus: 'Case Status',
    fraudUnitNotes: 'Fraud Unit Notes',
    closureDate: 'Closure Date',
    closureReason: 'Closure Reason',
    suspectedAmount: 'Suspected Amount',
    insuranceType: 'Insurance Type',

    claimType: 'Claim Type',
    fraudConfirmedDate: 'Fraud Confirmed Date',
    fraudDetectionMethod: 'Fraud Detection Method',
    fraudAmount: 'Fraud Amount',
    actionTaken: 'Action Taken',
    referredEntity: 'Referred Entity',

    fraudIndicatorType: 'Fraud Indicator Type',
    indicatorDescription: 'Indicator Description',
    occurrenceCount: 'Occurrence Count',
    riskLevel: 'Risk Level',
    systemRecommendation: 'System Recommendation',

    suspensionDate: 'Suspension Date',
    suspensionReason: 'Suspension Reason',
    suspensionDuration: 'Suspension Duration',
    currentStatus: 'Current Status',
    responsibleEmployee: 'Responsible Employee',

    metric: 'Metric',
    value: 'Value',
    totalCasesCount: 'Total Cases Count',
    closedCasesCount: 'Closed Cases Count',
    openCasesCount: 'Open Cases Count',
    averageProcessingTime: 'Average Case Processing Time',
    mostRepeatedFraudType: 'Most Repeated Fraud Type',
    totalFraudAmount: 'Total Fraud Amount',
    notCalculatedYet: 'Not calculated yet',

    website: 'Website',
    internal: 'Internal',
    other: 'Other',
    fraudConfirmedType: 'Fraud Confirmed',
    fraudSuspected: 'Fraud Suspected',
    violation: 'Violation',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    open: 'Open',
    suspended: 'Suspended',
    closed: 'Closed',
    motor: 'Motor',
    medical: 'Medical',
    life: 'Life',
    general: 'General',
    notApplicable: 'Not Applicable',
    day: 'day',
    days: 'days',
    hour: 'hour',
    hours: 'hours',
    minute: 'minute',
    minutes: 'minutes',
    reportTitles: {
      fraudCases: 'Fraud Cases Report',
      confirmedFraud: 'Confirmed Fraud Report',
      fraudIndicators: 'Fraud Indicators Report',
      suspendedFraud: 'Suspended Fraud Report',
      fraudPerformance: 'Fraud Performance Report',
    },
  },
  ar: {
    eyebrow: 'تقرير',
    previewSubtitle: 'جميع بلاغات الاحتيال المعتمدة باستثناء البلاغات المسودة.',
    confirmedFraudSubtitle: 'البلاغات المثبتة احتيال فقط، مع استبعاد المسودات.',
    fraudIndicatorsSubtitle: 'بلاغات الاحتيال المؤكد واشتباه الاحتيال فقط، مع استبعاد المسودات.',
    suspendedFraudSubtitle: 'بلاغات الاحتيال الموجودة في حالة معلق، مع استبعاد المسودات.',
    fraudPerformanceSubtitle: 'ملخص أداء وحدة مكافحة الاحتيال لجميع البلاغات غير المسودة.',
    exportExcel: 'تصدير Excel',
    resetFilters: 'إعادة ضبط الفلاتر',
    loading: 'جاري تحميل بيانات التقرير...',
    error: 'تعذر تحميل تقرير البلاغات من الخادم.',
    confirmedFraudError: 'تعذر تحميل تقرير البلاغات المثبتة احتيال من الخادم.',
    fraudIndicatorsError: 'تعذر تحميل تقرير مؤشرات الاحتيال من الخادم.',
    suspendedFraudError: 'تعذر تحميل تقرير بلاغات الاحتيال المعلقة من الخادم.',
    fraudPerformanceError: 'تعذر تحميل تقرير أداء وحدة مكافحة الاحتيال من الخادم.',
    noRows: 'لا توجد بلاغات مطابقة.',
    filterCaseId: 'تصفية رقم البلاغ',
    filterClaimId: 'تصفية رقم المطالبة',
    allCaseSources: 'جميع طرق استقبال البلاغ',
    allCaseTypes: 'جميع أنواع البلاغات',
    allPriorities: 'جميع الأولويات',
    allStatuses: 'جميع الحالات',
    allInsuranceTypes: 'جميع أنواع التأمين',
    startDate: 'تاريخ البداية',
    endDate: 'تاريخ النهاية',

    caseId: 'رقم البلاغ',
    claimId: 'رقم المطالبة',
    caseEntryDate: 'تاريخ إدخال البلاغ',
    caseSource: 'طريقة استقبال البلاغ',
    caseType: 'نوع البلاغ',
    priorityLevel: 'مستوى الأولوية',
    caseStatus: 'حالة البلاغ',
    fraudUnitNotes: 'ملاحظات وحدة مكافحة الاحتيال',
    closureDate: 'تاريخ الإغلاق',
    closureReason: 'سبب الإغلاق',
    suspectedAmount: 'المبلغ محل الاشتباه',
    insuranceType: 'نوع التأمين',

    claimType: 'نوع المطالبة',
    fraudConfirmedDate: 'تاريخ ثبوت الاحتيال',
    fraudDetectionMethod: 'آلية اكتشاف الاحتيال',
    fraudAmount: 'المبلغ المرتبط بالاحتيال',
    actionTaken: 'الإجراء المتخذ',
    referredEntity: 'الجهة المحالة لها',

    fraudIndicatorType: 'نوع مؤشر الاحتيال',
    indicatorDescription: 'وصف المؤشر',
    occurrenceCount: 'عدد مرات التكرار',
    riskLevel: 'درجة الخطورة',
    systemRecommendation: 'التوصية الآلية',

    suspensionDate: 'تاريخ التعليق',
    suspensionReason: 'سبب التعليق',
    suspensionDuration: 'مدة التعليق',
    currentStatus: 'الحالة الحالية',
    responsibleEmployee: 'الموظف المسؤول',

    metric: 'المؤشر',
    value: 'القيمة',
    totalCasesCount: 'إجمالي عدد البلاغات',
    closedCasesCount: 'عدد البلاغات المغلقة',
    openCasesCount: 'عدد البلاغات المفتوحة',
    averageProcessingTime: 'متوسط زمن معالجة البلاغ',
    mostRepeatedFraudType: 'أكثر أنواع الاحتيال تكرارًا',
    totalFraudAmount: 'إجمالي المبالغ المرتبطة بالاحتيال',
    notCalculatedYet: 'لم يتم احتسابه بعد',

    website: 'الموقع',
    internal: 'داخلي',
    other: 'أخرى',
    fraudConfirmedType: 'احتيال مؤكد',
    fraudSuspected: 'اشتباه الاحتيال',
    violation: 'مخالفة',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    open: 'مفتوح',
    suspended: 'معلق',
    closed: 'مغلق',
    motor: 'مركبات',
    medical: 'طبي',
    life: 'حياة',
    general: 'عام',
    notApplicable: 'غير منطبق',
    day: 'يوم',
    days: 'أيام',
    hour: 'ساعة',
    hours: 'ساعات',
    minute: 'دقيقة',
    minutes: 'دقائق',
    reportTitles: {
      fraudCases: 'تقرير البلاغات',
      confirmedFraud: 'تقرير البلاغات المثبتة احتيال',
      fraudIndicators: 'تقرير مؤشرات الاحتيال',
      suspendedFraud: 'تقرير بلاغات الاحتيال المعلقة',
      fraudPerformance: 'تقرير أداء وحدة مكافحة الاحتيال',
    },
  },
};

const routeToReportKey: Record<string, ReportKey> = {
  'Fraud Cases Report': 'fraudCases',
  'Confirmed Fraud Report': 'confirmedFraud',
  'Fraud Indicators Report': 'fraudIndicators',
  'Suspended Fraud Report': 'suspendedFraud',
  'Suspended Claims Report': 'suspendedFraud',
  'Fraud Performance Report': 'fraudPerformance',
  'Report Performance Fraud': 'fraudPerformance',
};

const initialFilters: FiltersState = {
  caseId: '',
  claimId: '',
  caseSource: '',
  caseType: '',
  priorityLevel: '',
  caseStatus: '',
  insuranceType: '',
  startDate: '',
  endDate: '',
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
}

function formatMoney(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return String(value ?? '-');
  return `SAR ${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toDateKey(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDurationMs(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

  const diff = endDate.getTime() - startDate.getTime();
  return diff > 0 ? diff : null;
}

function formatDurationFromMs(ms: number | null, t: ReportPageCopy) {
  if (ms === null || Number.isNaN(ms)) return '-';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;

  const dayLabel = days === 1 ? t.day : t.days;
  const hourLabel = hours === 1 ? t.hour : t.hours;
  const minuteLabel = minutes === 1 ? t.minute : t.minutes;

  return `${days} ${dayLabel}, ${hours} ${hourLabel}, ${minutes} ${minuteLabel}`;
}

function formatDurationFromDateToNow(value: string | null | undefined, t: ReportPageCopy) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diff = Date.now() - date.getTime();
  return formatDurationFromMs(diff > 0 ? diff : 0, t);
}

export default function ReportDetailsPage() {
  const { reportName } = useParams();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const t = useMemo(() => pageCopy[language], [language]);
  const isArabic = language === 'ar';

  const rawTitle = decodeURIComponent(reportName ?? 'Fraud Cases Report');
  const reportKey = routeToReportKey[rawTitle] ?? 'fraudCases';
  const isConfirmedFraudReport = reportKey === 'confirmedFraud';
  const isFraudIndicatorsReport = reportKey === 'fraudIndicators';
  const isSuspendedFraudReport = reportKey === 'suspendedFraud';
  const isFraudPerformanceReport = reportKey === 'fraudPerformance';

  const reportEndpoint = isConfirmedFraudReport
    ? '/api/reports/confirmed-fraud'
    : isFraudIndicatorsReport
      ? '/api/reports/fraud-indicators'
      : isSuspendedFraudReport
        ? '/api/reports/suspended-fraud'
        : isFraudPerformanceReport
          ? '/api/reports/fraud-performance'
          : '/api/reports/fraud-cases';

  const reportSubtitle = isConfirmedFraudReport
    ? t.confirmedFraudSubtitle
    : isFraudIndicatorsReport
      ? t.fraudIndicatorsSubtitle
      : isSuspendedFraudReport
        ? t.suspendedFraudSubtitle
        : isFraudPerformanceReport
          ? t.fraudPerformanceSubtitle
          : t.previewSubtitle;

  const reportError = isConfirmedFraudReport
    ? t.confirmedFraudError
    : isFraudIndicatorsReport
      ? t.fraudIndicatorsError
      : isSuspendedFraudReport
        ? t.suspendedFraudError
        : isFraudPerformanceReport
          ? t.fraudPerformanceError
          : t.error;

  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const data = await apiGet<ReportRow[]>(reportEndpoint);
        if (isMounted) setReportRows(data);
      } catch (error) {
        console.error(error);
        if (isMounted) setErrorMessage(reportError);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [reportEndpoint, reportError]);

  const translateCaseSource = (value?: string | null) => {
    if (language !== 'ar') return value || '-';
    if (value === 'Website') return t.website;
    if (value === 'Internal') return t.internal;
    if (value === 'Other') return t.other;
    return value || '-';
  };

  const translateCaseType = (value?: string | null) => {
    if (language !== 'ar') return value || '-';
    if (value === 'Fraud Confirmed') return t.fraudConfirmedType;
    if (value === 'Fraud Suspected') return t.fraudSuspected;
    if (value === 'Violation') return t.violation;
    return value || '-';
  };

  const translatePriority = (value?: string | null) => {
    if (language !== 'ar') return value || '-';
    if (value === 'High') return t.high;
    if (value === 'Medium') return t.medium;
    if (value === 'Low') return t.low;
    return value || '-';
  };

  const translateStatus = (value?: string | null) => {
    if (language !== 'ar') return value || '-';
    if (value === 'Open') return t.open;
    if (value === 'Suspended') return t.suspended;
    if (value === 'Closed') return t.closed;
    return value || '-';
  };

  const translateInsuranceType = (value?: string | null) => {
    if (language !== 'ar') return value || '-';
    if (value === 'Motor') return t.motor;
    if (value === 'Medical') return t.medical;
    if (value === 'Life') return t.life;
    if (value === 'General') return t.general;
    if (value === 'Not Applicable') return t.notApplicable;
    return value || '-';
  };

  const filteredRows = useMemo(() => {
    return reportRows.filter((item) => {
      if (normalize(item.case_status) === 'draft' || normalize(item.case_status) === 'مسودة') return false;

      const entryDate = toDateKey(item.case_entry_date);
      const matchesStart = !filters.startDate || (entryDate && entryDate >= filters.startDate);
      const matchesEnd = !filters.endDate || (entryDate && entryDate <= filters.endDate);

      return (
        matchesStart &&
        matchesEnd &&
        normalize(item.case_id).includes(normalize(filters.caseId)) &&
        normalize(item.claim_id).includes(normalize(filters.claimId)) &&
        (!filters.caseSource || item.case_source === filters.caseSource) &&
        (!filters.caseType || item.case_type === filters.caseType) &&
        (!filters.priorityLevel || item.priority_level === filters.priorityLevel) &&
        (!filters.caseStatus || item.case_status === filters.caseStatus) &&
        (!filters.insuranceType || item.insurance_type === filters.insuranceType)
      );
    });
  }, [filters, reportRows]);

  const performanceMetrics = useMemo(() => {
    const totalCasesCount = filteredRows.length;
    const closedCasesCount = filteredRows.filter((item) => item.case_status === 'Closed' || item.case_status === 'مغلق').length;
    const openCasesCount = filteredRows.filter((item) => item.case_status === 'Open' || item.case_status === 'مفتوح').length;
    const totalFraudAmount = filteredRows.reduce((sum, item) => sum + Number(item.fraud_amount ?? 0), 0);

    const processingDurations = filteredRows
      .filter((item) => item.case_status === 'Closed' || item.case_status === 'مغلق')
      .map((item) => {
        const openTime = item.open_time || item.case_entry_date;
        const closeTime = item.close_time || item.closure_date;
        return getDurationMs(openTime, closeTime);
      })
      .filter((value): value is number => value !== null);

    const averageProcessingMs = processingDurations.length > 0
      ? processingDurations.reduce((sum, value) => sum + value, 0) / processingDurations.length
      : null;

    return [
      { metric: t.totalCasesCount, value: totalCasesCount.toLocaleString() },
      { metric: t.closedCasesCount, value: closedCasesCount.toLocaleString() },
      { metric: t.openCasesCount, value: openCasesCount.toLocaleString() },
      { metric: t.averageProcessingTime, value: formatDurationFromMs(averageProcessingMs, t) },
      { metric: t.mostRepeatedFraudType, value: t.notCalculatedYet },
      { metric: t.totalFraudAmount, value: formatMoney(totalFraudAmount) },
    ];
  }, [filteredRows, t]);

  const reportHeaders = useMemo(() => {
    if (isFraudPerformanceReport) return [t.metric, t.value];

    if (isConfirmedFraudReport) {
      return [
        t.claimId,
        t.claimType,
        t.insuranceType,
        t.fraudConfirmedDate,
        t.fraudDetectionMethod,
        t.fraudAmount,
        t.actionTaken,
        t.referredEntity,
      ];
    }

    if (isFraudIndicatorsReport) {
      return [
        t.claimId,
        t.fraudIndicatorType,
        t.indicatorDescription,
        t.occurrenceCount,
        t.riskLevel,
        t.systemRecommendation,
      ];
    }

    if (isSuspendedFraudReport) {
      return [
        t.caseId,
        t.claimId,
        t.suspensionDate,
        t.suspensionReason,
        t.priorityLevel,
        t.suspensionDuration,
        t.currentStatus,
        t.responsibleEmployee,
      ];
    }

    return [
      t.caseId,
      t.claimId,
      t.caseEntryDate,
      t.caseSource,
      t.caseType,
      t.priorityLevel,
      t.caseStatus,
      t.fraudUnitNotes,
      t.closureDate,
      t.closureReason,
      t.suspectedAmount,
      t.insuranceType,
    ];
  }, [isConfirmedFraudReport, isFraudIndicatorsReport, isFraudPerformanceReport, isSuspendedFraudReport, t]);

  const getDisplayRow = (item: ReportRow): Array<string | number | null> => {
    if (isConfirmedFraudReport) {
      return [
        item.claim_id ?? '',
        item.claim_type ?? '',
        translateInsuranceType(item.insurance_type),
        formatDate(item.fraud_confirmed_date),
        item.fraud_detection_method ?? '',
        item.fraud_amount ?? '',
        item.action_taken ?? '',
        item.referred_entity ?? '',
      ];
    }

    if (isFraudIndicatorsReport) {
      return [
        item.claim_id ?? '',
        item.fraud_indicator_type ?? '',
        item.indicator_description ?? '',
        item.occurrence_count ?? '',
        item.risk_level ?? '',
        item.system_recommendation ?? '',
      ];
    }

    if (isSuspendedFraudReport) {
      return [
        item.case_id ?? '',
        item.claim_id ?? '',
        formatDate(item.suspension_date),
        item.suspension_reason ?? '',
        translatePriority(item.priority_level),
        formatDurationFromDateToNow(item.suspension_date, t),
        translateStatus(item.case_status),
        item.assigned_user ?? '',
      ];
    }

    return [
      item.case_id ?? '',
      item.claim_id ?? '',
      formatDate(item.case_entry_date),
      translateCaseSource(item.case_source),
      translateCaseType(item.case_type),
      translatePriority(item.priority_level),
      translateStatus(item.case_status),
      item.fraud_unit_notes ?? '',
      formatDate(item.closure_date),
      item.closure_reason ?? '',
      item.suspected_amount ?? '',
      translateInsuranceType(item.insurance_type),
    ];
  };

  const exportFilteredExcel = () => {
    if (isFraudPerformanceReport) {
      downloadCsv(
        'fraud-performance-report.csv',
        reportHeaders,
        performanceMetrics.map((item) => [item.metric, item.value])
      );
      return;
    }

    const excelRows = filteredRows.map((item) => getDisplayRow(item));

    downloadCsv(
      isConfirmedFraudReport
        ? 'confirmed-fraud-report.csv'
        : isFraudIndicatorsReport
          ? 'fraud-indicators-report.csv'
          : isSuspendedFraudReport
            ? 'suspended-fraud-report.csv'
            : 'fraud-cases-report.csv',
      reportHeaders,
      excelRows
    );
  };

  const tableRows = useMemo(() => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={reportHeaders.length}>{t.loading}</td>
        </tr>
      );
    }

    if (errorMessage) {
      return (
        <tr>
          <td colSpan={reportHeaders.length}>{errorMessage}</td>
        </tr>
      );
    }

    if (isFraudPerformanceReport) {
      return performanceMetrics.map((item) => (
        <tr key={item.metric}>
          <td>{item.metric}</td>
          <td>{item.value}</td>
        </tr>
      ));
    }

    if (filteredRows.length === 0) {
      return (
        <tr>
          <td colSpan={reportHeaders.length}>{t.noRows}</td>
        </tr>
      );
    }

    return filteredRows.map((item, index) => (
      <tr key={`${item.case_id ?? item.claim_id ?? 'row'}-${index}`}>
        {getDisplayRow(item).map((value, valueIndex) => (
          <td key={`${item.case_id ?? item.claim_id ?? index}-${valueIndex}`}>
            {value === '' || value === null || value === undefined ? '-' : value}
          </td>
        ))}
      </tr>
    ));
  }, [errorMessage, filteredRows, isFraudPerformanceReport, isLoading, performanceMetrics, reportHeaders.length, t]);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.reportTitles[reportKey]}
        subtitle={reportSubtitle}
        action={hasPermission(currentUser, 'reports.export') ? (
          <div className="actions-inline">
            <button className="btn primary" onClick={exportFilteredExcel} type="button">
              {t.exportExcel}
            </button>
          </div>
        ) : undefined}
      />

      <div className="card report-detail-filters">
        <input
          placeholder={t.filterCaseId}
          value={filters.caseId}
          onChange={(event) => setFilters((current) => ({ ...current, caseId: event.target.value }))}
        />
        <input
          placeholder={t.filterClaimId}
          value={filters.claimId}
          onChange={(event) => setFilters((current) => ({ ...current, claimId: event.target.value }))}
        />
        <select
          value={filters.caseSource}
          onChange={(event) => setFilters((current) => ({ ...current, caseSource: event.target.value }))}
        >
          <option value="">{t.allCaseSources}</option>
          <option value="Website">{t.website}</option>
          <option value="Internal">{t.internal}</option>
          <option value="Other">{t.other}</option>
        </select>
        {!isConfirmedFraudReport && (
          <select
            value={filters.caseType}
            onChange={(event) => setFilters((current) => ({ ...current, caseType: event.target.value }))}
          >
            <option value="">{t.allCaseTypes}</option>
            <option value="Fraud Confirmed">{t.fraudConfirmedType}</option>
            <option value="Fraud Suspected">{t.fraudSuspected}</option>
            <option value="Violation">{t.violation}</option>
          </select>
        )}
        <select
          value={filters.priorityLevel}
          onChange={(event) => setFilters((current) => ({ ...current, priorityLevel: event.target.value }))}
        >
          <option value="">{t.allPriorities}</option>
          <option value="High">{t.high}</option>
          <option value="Medium">{t.medium}</option>
          <option value="Low">{t.low}</option>
        </select>
        <select
          value={filters.caseStatus}
          onChange={(event) => setFilters((current) => ({ ...current, caseStatus: event.target.value }))}
        >
          <option value="">{t.allStatuses}</option>
          <option value="Open">{t.open}</option>
          <option value="Suspended">{t.suspended}</option>
          <option value="Closed">{t.closed}</option>
        </select>
        <select
          value={filters.insuranceType}
          onChange={(event) => setFilters((current) => ({ ...current, insuranceType: event.target.value }))}
        >
          <option value="">{t.allInsuranceTypes}</option>
          <option value="Motor">{t.motor}</option>
          <option value="Medical">{t.medical}</option>
          <option value="Life">{t.life}</option>
          <option value="General">{t.general}</option>
          <option value="Not Applicable">{t.notApplicable}</option>
        </select>
        <input
          aria-label={t.startDate}
          type="date"
          value={filters.startDate}
          onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
        />
        <input
          aria-label={t.endDate}
          type="date"
          value={filters.endDate}
          onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
        />
        <button className="btn" type="button" onClick={() => setFilters(initialFilters)}>
          {t.resetFilters}
        </button>
      </div>

      <Table headers={reportHeaders}>{tableRows}</Table>
    </div>
  );
}
