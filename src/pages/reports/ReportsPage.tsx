import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { reports } from '../../data/mockData';
import type { AppLanguage } from '../../layout/AppLayout';

type ReportsCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  reportLabel: string;
  open: string;
  noResults: string;
};

const pageCopy: Record<AppLanguage, ReportsCopy> = {
  en: {
    eyebrow: 'Workspace',
    title: 'Reports',
    subtitle: 'Browse and open fraud reports.',
    searchPlaceholder: 'Search reports',
    reportLabel: 'Report',
    open: 'Open',
    noResults: 'No matching reports found.',
  },
  ar: {
    eyebrow: 'مساحة العمل',
    title: 'التقارير',
    subtitle: 'استعرض وافتح تقارير الاحتيال.',
    searchPlaceholder: 'ابحث في التقارير',
    reportLabel: 'تقرير',
    open: 'فتح',
    noResults: 'لا توجد تقارير مطابقة.',
  },
};

const reportNameMap: Record<string, { en: string; ar: string; enDescription?: string; arDescription?: string }> = {
  'Fraud Cases Report': {
    en: 'Fraud Cases Report',
    ar: 'تقرير بلاغات الاحتيال',
    enDescription: 'All registered fraud cases with case details and closure info.',
    arDescription: 'جميع بلاغات الاحتيال المسجلة مع تفاصيل البلاغ ومعلومات الإغلاق.',
  },
  'Confirmed Fraud Report': {
    en: 'Confirmed Fraud Report',
    ar: 'تقرير الاحتيال المؤكد',
    enDescription: 'Cases where fraud has been confirmed.',
    arDescription: 'البلاغات التي تم فيها تأكيد الاحتيال.',
  },
  'Fraud Indicators Report': {
    en: 'Fraud Indicators Report',
    ar: 'تقرير مؤشرات الاحتيال',
    enDescription: 'System-detected fraud indicators, risk levels, and recommendations.',
    arDescription: 'مؤشرات الاحتيال المكتشفة من النظام وقرارات المحللين.',
  },
  'Suspended Fraud Report': {
    en: 'Suspended Fraud Report',
    ar: 'تقرير بلاغات الاحتيال المعلقة',
    enDescription: 'Fraud cases currently in Suspended status.',
    arDescription: 'بلاغات الاحتيال الموجودة حاليًا في حالة معلق.',
  },
  'Fraud Performance Report': {
    en: 'Fraud Performance Report',
    ar: 'تقرير أداء وحدة الاحتيال',
    enDescription: 'Fraud unit workload and performance summary.',
    arDescription: 'ملخص عبء العمل والأداء لوحدة الاحتيال.',
  },
};

export default function ReportsPage() {
  const { language } = useOutletContext<{ language: AppLanguage }>();
  const t = useMemo(() => pageCopy[language], [language]);
  const isArabic = language === 'ar';
  const [searchValue, setSearchValue] = useState('');

  const visibleReports = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return reports.filter((report) => {
      const mapped = reportNameMap[report.name];
      const displayName = mapped ? mapped[language] : report.name;
      const displayDescription =
        mapped?.[language === 'ar' ? 'arDescription' : 'enDescription'] ?? report.description;

      if (!normalizedSearch) return true;

      return (
        displayName.toLowerCase().includes(normalizedSearch) ||
        displayDescription.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [language, searchValue]);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

      <div className="card reports-filter">
        <input
          placeholder={t.searchPlaceholder}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </div>

      <div className="reports-grid">
        {visibleReports.length > 0 ? (
          visibleReports.map((report) => {
            const mapped = reportNameMap[report.name];
            const displayName = mapped ? mapped[language] : report.name;
            const displayDescription =
              mapped?.[language === 'ar' ? 'arDescription' : 'enDescription'] ?? report.description;

            return (
              <div className="card report-card" key={report.name}>
                <span className="eyebrow">{t.reportLabel}</span>
                <h3>{displayName}</h3>
                <p className="muted">{displayDescription}</p>
                <div className="actions-inline">
                  <Link className="btn primary" to={`/app/reports/${encodeURIComponent(report.name)}`}>
                    {t.open}
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card report-card">
            <p className="muted">{t.noResults}</p>
          </div>
        )}
      </div>
    </div>
  );
}
