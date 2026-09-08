import { Link, useOutletContext } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Table from '../../components/Table';
import type { AppLanguage, AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import { apiGet } from '../../api';

type BackendFraudCase = {
  id: number;
  case_number: string;
  claim_id: string | null;
  case_entry_date: string | null;
  case_source: string | null;
  case_source_other: string | null;
  case_type: string | null;
  priority_level: string | null;
  case_status: string | null;
  fraud_unit_notes: string | null;
  closure_date: string | null;
  closure_reason: string | null;
  suspected_amount: string | number | null;
  fraud_amount: string | number | null;
  insurance_type: string | null;
  risk_level: string | null;
  created_at: string | null;
  assigned_user: string | null;
};

type DashboardCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  generateReport: string;
  reviewQueue: string;

  overviewEyebrow: string;
  overviewTitle: string;
  overviewSubtitle: string;
  totalOperationalCases: string;
  openOperationalCases: string;
  closedOperationalCases: string;
  totalFraudAmount: string;
  allCasesIncludingDrafts: string;
  activeCaseWorkload: string;
  completedCases: string;
  fraudExposure: string;

  totalCases: string;
  totalCasesSubtitle: string;
  draftCases: string;
  draftCasesSubtitle: string;
  openCases: string;
  openCasesSubtitle: string;
  closedCases: string;
  closedCasesSubtitle: string;
  confirmedFraudCases: string;
  confirmedFraudCasesSubtitle: string;
  suspendedFraud: string;
  suspendedFraudSubtitle: string;
  highPriorityCases: string;
  highPriorityCasesSubtitle: string;
  liveWorkloadSnapshot: string;

  casesByStatus: string;
  casesByStatusSubtitle: string;
  casesByPriority: string;
  casesByPrioritySubtitle: string;
  casesByInsuranceType: string;
  casesByInsuranceTypeSubtitle: string;
  casesByCaseType: string;
  casesByCaseTypeSubtitle: string;

  draft: string;
  open: string;
  suspended: string;
  closed: string;
  high: string;
  medium: string;
  low: string;
  motor: string;
  medical: string;
  life: string;
  general: string;
  notApplicable: string;
  fraudConfirmed: string;
  fraudSuspected: string;
  violation: string;
  other: string;

  recentCases: string;
  recentCasesSubtitle: string;
  recentCasesTableTitle: string;
  recentCasesTableSubtitle: string;
  caseId: string;
  claimId: string;
  caseType: string;
  priority: string;
  status: string;
  insuranceType: string;
  caseEntryDate: string;
  amount: string;
  noCases: string;
  loadingDashboard: string;
  errorLoadingDashboard: string;
};

const pageCopy: Record<AppLanguage, DashboardCopy> = {
  en: {
    eyebrow: 'Workspace',
    title: 'Dashboard Screen',
    subtitle: 'A live overview of fraud cases, suspended cases, confirmed fraud, and operational workload.',
    generateReport: 'Generate Report',
    reviewQueue: 'Review Queue',

    overviewEyebrow: 'Overview',
    overviewTitle: "Today's fraud operations snapshot",
    overviewSubtitle: 'Updated to match the current case lifecycle: Draft, Open, Suspended, Closed, and fraud indicators.',
    totalOperationalCases: 'Total Cases',
    openOperationalCases: 'Open Cases',
    closedOperationalCases: 'Closed Cases',
    totalFraudAmount: 'Fraud Amount',
    allCasesIncludingDrafts: 'Including drafts',
    activeCaseWorkload: 'Active workload',
    completedCases: 'Closed workload',
    fraudExposure: 'Confirmed / suspected exposure',

    totalCases: 'Total Cases',
    totalCasesSubtitle: 'All cases including drafts',
    draftCases: 'Draft Cases',
    draftCasesSubtitle: 'Saved but not submitted',
    openCases: 'Open Cases',
    openCasesSubtitle: 'Submitted and editable',
    closedCases: 'Closed Cases',
    closedCasesSubtitle: 'Locked unless reopened',
    confirmedFraudCases: 'Confirmed Fraud Cases',
    confirmedFraudCasesSubtitle: 'Case type = Fraud Confirmed',
    suspendedFraud: 'Suspended Fraud Cases',
    suspendedFraudSubtitle: 'Case status = Suspended',
    highPriorityCases: 'High Priority Cases',
    highPriorityCasesSubtitle: 'Priority = High',
    liveWorkloadSnapshot: 'Live database snapshot',

    casesByStatus: 'Cases By Status',
    casesByStatusSubtitle: 'Distribution by the current lifecycle statuses.',
    casesByPriority: 'Cases By Priority',
    casesByPrioritySubtitle: 'Priority distribution for all cases.',
    casesByInsuranceType: 'Cases By Insurance Type',
    casesByInsuranceTypeSubtitle: 'Distribution by insurance line.',
    casesByCaseType: 'Cases By Case Type',
    casesByCaseTypeSubtitle: 'Fraud reporting category mix.',

    draft: 'Draft',
    open: 'Open',
    suspended: 'Suspended',
    closed: 'Closed',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    motor: 'Motor',
    medical: 'Medical',
    life: 'Life',
    general: 'General',
    notApplicable: 'Not Applicable',
    fraudConfirmed: 'Fraud Confirmed',
    fraudSuspected: 'Fraud Suspected',
    violation: 'Violation',
    other: 'Other',

    recentCases: 'Recent Cases',
    recentCasesSubtitle: 'Latest cases created or updated in the fraud system.',
    recentCasesTableTitle: 'Recent cases',
    recentCasesTableSubtitle: 'A quick view of the latest fraud case records.',
    caseId: 'Case Id',
    claimId: 'Claim Id',
    caseType: 'Case Type',
    priority: 'Priority',
    status: 'Status',
    insuranceType: 'Insurance Type',
    caseEntryDate: 'Case Entry Date',
    amount: 'Fraud Amount',
    noCases: 'No cases found.',
    loadingDashboard: 'Loading dashboard data from backend...',
    errorLoadingDashboard: 'Could not load dashboard data from backend.',
  },
  ar: {
    eyebrow: 'مساحة العمل',
    title: 'شاشة لوحة التحكم',
    subtitle: 'نظرة مباشرة على البلاغات، البلاغات المعلقة، الاحتيال المؤكد، وعبء العمل التشغيلي.',
    generateReport: 'إنشاء تقرير',
    reviewQueue: 'مراجعة القائمة',

    overviewEyebrow: 'نظرة عامة',
    overviewTitle: 'ملخص عمليات مكافحة الاحتيال اليوم',
    overviewSubtitle: 'تم تحديثها لتتوافق مع دورة حياة البلاغ الحالية: مسودة، مفتوح، معلق، مغلق، ومؤشرات الاحتيال.',
    totalOperationalCases: 'إجمالي البلاغات',
    openOperationalCases: 'البلاغات المفتوحة',
    closedOperationalCases: 'البلاغات المغلقة',
    totalFraudAmount: 'المبلغ المرتبط بالاحتيال',
    allCasesIncludingDrafts: 'بما في ذلك المسودات',
    activeCaseWorkload: 'عبء العمل النشط',
    completedCases: 'البلاغات المنجزة',
    fraudExposure: 'قيمة الاحتيال المؤكد أو المشتبه به',

    totalCases: 'إجمالي البلاغات',
    totalCasesSubtitle: 'كل البلاغات بما فيها المسودات',
    draftCases: 'البلاغات المسودة',
    draftCasesSubtitle: 'محفوظة ولم يتم تقديمها',
    openCases: 'البلاغات المفتوحة',
    openCasesSubtitle: 'مقدمة وقابلة للتعديل',
    closedCases: 'البلاغات المغلقة',
    closedCasesSubtitle: 'مقفلة ما لم تتم إعادة فتحها',
    confirmedFraudCases: 'البلاغات المثبتة احتيال',
    confirmedFraudCasesSubtitle: 'نوع البلاغ = احتيال مؤكد',
    suspendedFraud: 'بلاغات الاحتيال المعلقة',
    suspendedFraudSubtitle: 'حالة البلاغ = معلق',
    highPriorityCases: 'البلاغات عالية الأولوية',
    highPriorityCasesSubtitle: 'الأولوية = عالية',
    liveWorkloadSnapshot: 'لقطة مباشرة من قاعدة البيانات',

    casesByStatus: 'البلاغات حسب الحالة',
    casesByStatusSubtitle: 'توزيع البلاغات حسب دورة الحياة الحالية.',
    casesByPriority: 'البلاغات حسب الأولوية',
    casesByPrioritySubtitle: 'توزيع الأولويات لكل البلاغات.',
    casesByInsuranceType: 'البلاغات حسب نوع التأمين',
    casesByInsuranceTypeSubtitle: 'توزيع البلاغات حسب نوع التأمين.',
    casesByCaseType: 'البلاغات حسب نوع البلاغ',
    casesByCaseTypeSubtitle: 'توزيع البلاغات حسب فئة الاشتباه أو المخالفة.',

    draft: 'مسودة',
    open: 'مفتوح',
    suspended: 'معلق',
    closed: 'مغلق',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    motor: 'مركبات',
    medical: 'طبي',
    life: 'حياة',
    general: 'عام',
    notApplicable: 'غير منطبق',
    fraudConfirmed: 'احتيال مؤكد',
    fraudSuspected: 'اشتباه الاحتيال',
    violation: 'مخالفة',
    other: 'أخرى',

    recentCases: 'البلاغات الحديثة',
    recentCasesSubtitle: 'آخر البلاغات التي تم إنشاؤها أو تحديثها في نظام مكافحة الاحتيال.',
    recentCasesTableTitle: 'أحدث البلاغات',
    recentCasesTableSubtitle: 'عرض سريع لأحدث سجلات بلاغات الاحتيال.',
    caseId: 'رقم البلاغ',
    claimId: 'رقم المطالبة',
    caseType: 'نوع البلاغ',
    priority: 'الأولوية',
    status: 'الحالة',
    insuranceType: 'نوع التأمين',
    caseEntryDate: 'تاريخ إدخال البلاغ',
    amount: 'المبلغ المرتبط بالاحتيال',
    noCases: 'لا توجد بلاغات.',
    loadingDashboard: 'جاري تحميل بيانات لوحة التحكم من الخادم...',
    errorLoadingDashboard: 'تعذر تحميل بيانات لوحة التحكم من الخادم.',
  },
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function isOneOf(value: unknown, options: string[]) {
  return options.includes(normalizeText(value));
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
}

function countBy(items: BackendFraudCase[], key: keyof BackendFraudCase, allowedValues: string[]) {
  return allowedValues.map((value) => ({
    key: value,
    value: items.filter((item) => normalizeText(item[key]) === value).length,
  }));
}

export default function DashboardPage() {
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const t = useMemo(() => pageCopy[language], [language]);
  const isArabic = language === 'ar';

  const [cases, setCases] = useState<BackendFraudCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadCases() {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const data = await apiGet<BackendFraudCase[]>('/api/cases');

        if (isMounted) {
          setCases(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(t.errorLoadingDashboard);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCases();

    return () => {
      isMounted = false;
    };
  }, [t.errorLoadingDashboard]);

  const summary = useMemo(() => {
    const totalCases = cases.length;
    const draftCases = cases.filter((item) => normalizeText(item.case_status) === 'Draft').length;
    const openCases = cases.filter((item) => normalizeText(item.case_status) === 'Open').length;
    const closedCases = cases.filter((item) => normalizeText(item.case_status) === 'Closed').length;
    const confirmedFraudCases = cases.filter((item) => isOneOf(item.case_type, ['Fraud Confirmed', 'احتيال مؤكد'])).length;
    const suspendedFraud = cases.filter((item) => isOneOf(item.case_status, ['Suspended', 'معلق'])).length;
    const highPriorityCases = cases.filter((item) => isOneOf(item.priority_level, ['High', 'عالية'])).length;
    const fraudAmount = cases.reduce((sum, item) => sum + numberValue(item.fraud_amount), 0);

    return {
      totalCases,
      draftCases,
      openCases,
      closedCases,
      confirmedFraudCases,
      suspendedFraud,
      highPriorityCases,
      fraudAmount,
    };
  }, [cases]);

  const formatNumber = (value: number) => value.toLocaleString();

  const formatMoney = (value: number) => {
    if (value >= 1000000) return `SAR ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `SAR ${(value / 1000).toFixed(0)}K`;
    return `SAR ${value.toLocaleString()}`;
  };

  const cards = useMemo(
    () => [
      { title: t.totalCases, value: formatNumber(summary.totalCases), subtitle: t.totalCasesSubtitle },
      { title: t.draftCases, value: formatNumber(summary.draftCases), subtitle: t.draftCasesSubtitle },
      { title: t.openCases, value: formatNumber(summary.openCases), subtitle: t.openCasesSubtitle },
      { title: t.closedCases, value: formatNumber(summary.closedCases), subtitle: t.closedCasesSubtitle },
      { title: t.confirmedFraudCases, value: formatNumber(summary.confirmedFraudCases), subtitle: t.confirmedFraudCasesSubtitle },
      { title: t.suspendedFraud, value: formatNumber(summary.suspendedFraud), subtitle: t.suspendedFraudSubtitle },
      { title: t.highPriorityCases, value: formatNumber(summary.highPriorityCases), subtitle: t.highPriorityCasesSubtitle },
      { title: t.totalFraudAmount, value: formatMoney(summary.fraudAmount), subtitle: t.fraudExposure },
    ],
    [summary, t]
  );

  const labelStatus = (value: string) => {
    if (language === 'ar') {
      if (value === 'Draft') return t.draft;
      if (value === 'Open') return t.open;
      if (value === 'Suspended') return t.suspended;
      if (value === 'Closed') return t.closed;
    }
    return value;
  };

  const labelPriority = (value: string) => {
    if (language === 'ar') {
      if (value === 'High') return t.high;
      if (value === 'Medium') return t.medium;
      if (value === 'Low') return t.low;
    }
    return value;
  };

  const labelInsurance = (value: string) => {
    if (language === 'ar') {
      if (value === 'Motor') return t.motor;
      if (value === 'Medical') return t.medical;
      if (value === 'Life') return t.life;
      if (value === 'General') return t.general;
      if (value === 'Not Applicable') return t.notApplicable;
    }
    return value;
  };

  const labelCaseType = (value: string) => {
    if (language === 'ar') {
      if (value === 'Fraud Confirmed') return t.fraudConfirmed;
      if (value === 'Fraud Suspected') return t.fraudSuspected;
      if (value === 'Violation') return t.violation;
    }
    return value;
  };

  const statusData = useMemo(
    () =>
      countBy(cases, 'case_status', ['Draft', 'Open', 'Suspended', 'Closed']).map((item) => ({
        label: labelStatus(item.key),
        value: item.value,
      })),
    [cases, language]
  );

  const priorityData = useMemo(
    () =>
      countBy(cases, 'priority_level', ['High', 'Medium', 'Low']).map((item) => ({
        label: labelPriority(item.key),
        value: item.value,
      })),
    [cases, language]
  );

  const insuranceTypeData = useMemo(
    () =>
      countBy(cases, 'insurance_type', ['Not Applicable', 'Motor', 'Medical', 'Life', 'General']).map((item) => ({
        label: labelInsurance(item.key),
        value: item.value,
      })),
    [cases, language]
  );

  const caseTypeData = useMemo(
    () =>
      countBy(cases, 'case_type', ['Fraud Confirmed', 'Fraud Suspected', 'Violation']).map((item) => ({
        label: labelCaseType(item.key),
        value: item.value,
      })),
    [cases, language]
  );

  const chartMax = useMemo(() => {
    const allValues = [...statusData, ...priorityData, ...insuranceTypeData, ...caseTypeData].map((item) => item.value);
    return Math.max(...allValues, 1);
  }, [statusData, priorityData, insuranceTypeData, caseTypeData]);

  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => {
        const first = new Date(b.created_at || b.case_entry_date || '').getTime();
        const second = new Date(a.created_at || a.case_entry_date || '').getTime();
        return (Number.isNaN(first) ? 0 : first) - (Number.isNaN(second) ? 0 : second);
      })
      .slice(0, 6);
  }, [cases]);

  const renderBars = (items: { label: string; value: number }[]) => (
    <div className="bars">
      {items.map((item) => (
        <div key={item.label}>
          <span className="bar-label">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </span>
          <progress value={item.value} max={chartMax} />
        </div>
      ))}
    </div>
  );

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        action={hasPermission(currentUser, 'reports.view') ? <Link className="btn primary" to="/app/reports">{t.generateReport}</Link> : undefined}
      />

      {isLoading ? (
        <div className="card" style={{ marginBottom: 16 }}>
          {t.loadingDashboard}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="card" style={{ marginBottom: 16, color: '#b42318' }}>
          {errorMessage}
        </div>
      ) : null}

      <section className="dashboard-overview">
        <div className="card dashboard-summary">
          <div className="dashboard-summary-header">
            <div>
              <span className="eyebrow">{t.overviewEyebrow}</span>
              <h3>{t.overviewTitle}</h3>
              <p className="muted">{t.overviewSubtitle}</p>
            </div>
            {hasPermission(currentUser, 'cases.view') ? <Link className="btn" to="/app/queue">{t.reviewQueue}</Link> : null}
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span className="muted small">{t.totalOperationalCases}</span>
              <strong>{formatNumber(summary.totalCases)}</strong>
              <span className="muted small">{t.allCasesIncludingDrafts}</span>
            </div>
            <div className="summary-item">
              <span className="muted small">{t.openOperationalCases}</span>
              <strong>{formatNumber(summary.openCases)}</strong>
              <span className="muted small">{t.activeCaseWorkload}</span>
            </div>
            <div className="summary-item">
              <span className="muted small">{t.closedOperationalCases}</span>
              <strong>{formatNumber(summary.closedCases)}</strong>
              <span className="muted small">{t.completedCases}</span>
            </div>
            <div className="summary-item">
              <span className="muted small">{t.totalFraudAmount}</span>
              <strong>{formatMoney(summary.fraudAmount)}</strong>
              <span className="muted small">{t.fraudExposure}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="card-grid">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} trendLabel={t.liveWorkloadSnapshot} />
        ))}
      </div>

      <div className="two-col">
        <div className="card chart-card">
          <div className="chart-card-header">
            <div>
              <h3>{t.casesByStatus}</h3>
              <p className="muted">{t.casesByStatusSubtitle}</p>
            </div>
          </div>
          {renderBars(statusData)}
        </div>

        <div className="card chart-card">
          <div className="chart-card-header">
            <div>
              <h3>{t.casesByPriority}</h3>
              <p className="muted">{t.casesByPrioritySubtitle}</p>
            </div>
          </div>
          {renderBars(priorityData)}
        </div>
      </div>

      <div className="two-col">
        <div className="card chart-card">
          <div className="chart-card-header">
            <div>
              <h3>{t.casesByInsuranceType}</h3>
              <p className="muted">{t.casesByInsuranceTypeSubtitle}</p>
            </div>
          </div>
          {renderBars(insuranceTypeData)}
        </div>

        <div className="card chart-card">
          <div className="chart-card-header">
            <div>
              <h3>{t.casesByCaseType}</h3>
              <p className="muted">{t.casesByCaseTypeSubtitle}</p>
            </div>
          </div>
          {renderBars(caseTypeData)}
        </div>
      </div>

      <PageHeader eyebrow={t.eyebrow} title={t.recentCases} subtitle={t.recentCasesSubtitle} />

      <Table
        title={t.recentCasesTableTitle}
        subtitle={t.recentCasesTableSubtitle}
        headers={[t.caseId, t.claimId, t.caseEntryDate, t.caseType, t.priority, t.status, t.insuranceType, t.amount]}
      >
        {recentCases.length > 0 ? (
          recentCases.map((item) => (
            <tr key={item.id}>
              <td>
                <Link className="text-link" to={`/app/cases/${item.case_number}`}>
                  {item.case_number}
                </Link>
              </td>
              <td>{item.claim_id || '-'}</td>
              <td>{formatDate(item.case_entry_date)}</td>
              <td>{labelCaseType(normalizeText(item.case_type) || t.other)}</td>
              <td>
                <span className={`badge ${(normalizeText(item.priority_level) || 'medium').toLowerCase()}`}>
                  {labelPriority(normalizeText(item.priority_level) || 'Medium')}
                </span>
              </td>
              <td>{labelStatus(normalizeText(item.case_status) || '-')}</td>
              <td>{labelInsurance(normalizeText(item.insurance_type) || t.other)}</td>
              <td>{formatMoney(numberValue(item.fraud_amount))}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '24px 16px' }}>
              {isLoading ? t.loadingDashboard : t.noCases}
            </td>
          </tr>
        )}
      </Table>
    </div>
  );
}
