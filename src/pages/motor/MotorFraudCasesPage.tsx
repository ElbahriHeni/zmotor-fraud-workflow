import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiGet, apiPostDownload } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import type { MotorFraudCase } from '../../types/motorFraud';

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
}

function statusLabel(status: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    Draft: { en: 'Draft', ar: 'مسودة' },
    'With Legal': { en: 'With Legal', ar: 'لدى الفريق القانوني' },
    'Returned to Motor from Legal': { en: 'Returned by Legal', ar: 'معاد من القانونية للمركبات' },
    'With Fraud': { en: 'With Fraud', ar: 'لدى فريق الاحتيال' },
    'Returned to Motor from Fraud': { en: 'Returned by Fraud', ar: 'معاد من الاحتيال للمركبات' },
    Closed: { en: 'Closed', ar: 'مغلق' },
    Rejected: { en: 'Rejected / Closed', ar: 'مرفوض / مغلق' },
    'Closed by Motor': { en: 'Closed by Motor', ar: 'مغلق من فريق المركبات' },
  };
  return labels[status]?.[language] || status;
}

function teamLabel(team: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    MOTOR: { en: 'Motor', ar: 'المركبات' },
    LEGAL: { en: 'Legal', ar: 'القانونية' },
    FRAUD: { en: 'Fraud', ar: 'الاحتيال' },
    CLOSED: { en: 'Closed', ar: 'مغلق' },
  };
  return labels[team]?.[language] || team;
}

export default function MotorFraudCasesPage() {
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const [cases, setCases] = useState<MotorFraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [classification, setClassification] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const canCreate = hasPermission(currentUser, 'motor_fraud.create');
  const canExport = hasPermission(currentUser, 'motor_fraud.export');

  useEffect(() => {
    let alive = true;
    apiGet<MotorFraudCase[]>('/api/motor-fraud/cases')
      .then((data) => { if (alive) setCases(data); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Could not load Motor Fraud cases.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const sources = useMemo(() => Array.from(new Set(cases.map((item) => item.indicator_source).filter((value): value is string => Boolean(value)))), [cases]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cases.filter((item) => {
      if (needle) {
        const haystack = [item.case_number, item.claim_number, item.accident_number, item.employee_name, item.administrative_entity]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (status && item.status !== status) return false;
      if (source && item.indicator_source !== source) return false;
      if (classification && item.indicator_classification !== classification) return false;
      const value = item.received_date?.slice(0, 10) || '';
      if (fromDate && (!value || value < fromDate)) return false;
      if (toDate && (!value || value > toDate)) return false;
      return true;
    });
  }, [cases, search, status, source, classification, fromDate, toDate]);

  const exportResults = async () => {
    try {
      setExporting(true);
      setError('');
      await apiPostDownload('/api/motor-fraud/export', { ids: filtered.map((item) => item.id) }, 'Motor_Fraud_Cases.xlsx');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={isArabic ? 'سير عمل المركبات' : 'Motor workflow'}
        title={isArabic ? 'حالات احتيال المركبات' : 'Motor Fraud Cases'}
        subtitle={isArabic ? 'البحث ومتابعة حالات الاشتباه المحالة بين المركبات والقانونية والاحتيال.' : 'Search and follow cases routed between Motor, Legal, and Fraud.'}
        action={canCreate ? <Link className="btn primary" to="/app/motor-fraud/new">{isArabic ? 'إنشاء حالة' : 'Create Case'}</Link> : undefined}
      />

      <div className="card motor-filter-card">
        <div className="motor-filter-grid">
          <label>
            <span>{isArabic ? 'بحث' : 'Search'}</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isArabic ? 'رقم المطالبة، الحادث أو المعاملة' : 'Claim, accident, or case number'} />
          </label>
          <label>
            <span>{isArabic ? 'الحالة' : 'Status'}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              {['Draft','With Legal','Returned to Motor from Legal','With Fraud','Returned to Motor from Fraud','Closed','Rejected','Closed by Motor'].map((value) => <option key={value} value={value}>{statusLabel(value, language)}</option>)}
            </select>
          </label>
          <label>
            <span>{isArabic ? 'مصدر المؤشر' : 'Indicator Source'}</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              {sources.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>{isArabic ? 'تصنيف المؤشر' : 'Classification'}</span>
            <select value={classification} onChange={(e) => setClassification(e.target.value)}>
              <option value="">{isArabic ? 'الكل' : 'All'}</option>
              <option value="منخفض">منخفض</option>
              <option value="متوسط">متوسط</option>
              <option value="عالي">عالي</option>
            </select>
          </label>
          <label><span>{isArabic ? 'من تاريخ الاستلام' : 'Received From'}</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label><span>{isArabic ? 'إلى تاريخ الاستلام' : 'Received To'}</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
        </div>
        <div className="motor-filter-actions">
          <button className="btn" type="button" onClick={() => { setSearch(''); setStatus(''); setSource(''); setClassification(''); setFromDate(''); setToDate(''); }}>{isArabic ? 'إعادة ضبط' : 'Reset'}</button>
          {canExport ? <button className="btn" type="button" disabled={!filtered.length || exporting} onClick={exportResults}>{exporting ? (isArabic ? 'جاري التصدير...' : 'Exporting...') : (isArabic ? 'تصدير النتائج' : 'Export Results')}</button> : null}
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="card"><p className="muted">{isArabic ? 'جاري تحميل الحالات...' : 'Loading Motor Fraud cases...'}</p></div> : (
        <Table
          title={isArabic ? `الحالات (${filtered.length})` : `Cases (${filtered.length})`}
          subtitle={isArabic ? 'المستخدم من فريق المركبات يرى الحالات التي أنشأها، بينما فرق المراجعة ترى الحالات المصرح بها.' : 'Motor initiators see their own cases; review teams see the cases allowed by their permissions.'}
          headers={[
            isArabic ? 'رقم المعاملة' : 'Case #',
            isArabic ? 'رقم المطالبة' : 'Claim #',
            isArabic ? 'رقم الحادث' : 'Accident #',
            isArabic ? 'تصنيف المؤشر' : 'Classification',
            isArabic ? 'الحالة' : 'Status',
            isArabic ? 'الفريق الحالي' : 'Current Team',
            isArabic ? 'تاريخ الاستلام' : 'Received',
            isArabic ? 'الأيام' : 'Days',
            isArabic ? 'إجراء' : 'Action',
          ]}
        >
          {filtered.length ? filtered.map((item) => {
            const days = item.current_team === 'FRAUD' || item.second_escalation_at ? item.second_escalation_days : item.first_escalation_days;
            return (
              <tr key={item.id}>
                <td><strong>{item.case_number}</strong></td>
                <td>{item.claim_number}</td>
                <td>{item.accident_number || '-'}</td>
                <td><span className={`motor-risk-badge ${item.indicator_classification === 'عالي' ? 'high' : item.indicator_classification === 'متوسط' ? 'medium' : 'low'}`}>{item.indicator_classification}</span></td>
                <td>{statusLabel(item.status, language)}</td>
                <td>{teamLabel(item.current_team, language)}</td>
                <td>{formatDate(item.received_date)}</td>
                <td>{days ?? '-'}</td>
                <td><Link className="btn small" to={`/app/motor-fraud/${item.id}`}>{isArabic ? 'فتح' : 'Open'}</Link></td>
              </tr>
            );
          }) : <tr><td colSpan={9} className="muted">{isArabic ? 'لا توجد حالات مطابقة.' : 'No matching Motor Fraud cases.'}</td></tr>}
        </Table>
      )}
    </div>
  );
}
