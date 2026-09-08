import { useEffect, useMemo, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiGet } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';

type AuditLogRow = {
  id: number;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action_code: string;
  entity_type: string | null;
  entity_id: string | null;
  success: boolean;
  status_code: number | null;
  ip_address: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AuditLogPage() {
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = currentUser?.canManageSecurity || currentUser?.permissions?.includes('*');

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: '500' });
    if (actor.trim()) params.set('actor', actor.trim());
    if (action.trim()) params.set('action', action.trim());
    return params.toString();
  }, [action, actor]);

  useEffect(() => {
    if (!isAdmin) return;

    let mounted = true;
    setIsLoading(true);
    setError('');

    apiGet<AuditLogRow[]>(`/api/audit-logs?${query}`)
      .then((data) => {
        if (mounted) setRows(data);
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load audit logs.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAdmin, query]);

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isArabic ? 'سجل التدقيق' : 'Audit Log'}
        subtitle={isArabic ? 'مراجعة إجراءات المستخدمين والعمليات الأمنية داخل النظام.' : 'Review user actions and security-relevant activity across the system.'}
        eyebrow={isArabic ? 'الأمان والامتثال' : 'Security & Compliance'}
      />

      <div className="card form-grid two-col-form" style={{ marginBottom: 18 }}>
        <label>
          <span>{isArabic ? 'المستخدم' : 'User'}</span>
          <input value={actor} onChange={(event) => setActor(event.target.value)} placeholder={isArabic ? 'الاسم أو البريد الإلكتروني' : 'Name or email'} />
        </label>
        <label>
          <span>{isArabic ? 'رمز الإجراء' : 'Action Code'}</span>
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="CASE_STATUS_CHANGED" />
        </label>
      </div>

      {error ? <div className="card" style={{ color: '#b42318', marginBottom: 16 }}>{error}</div> : null}
      {isLoading ? <div className="card">{isArabic ? 'جاري تحميل سجل التدقيق...' : 'Loading audit logs...'}</div> : (
        <Table headers={[
          isArabic ? 'التوقيت' : 'Time',
          isArabic ? 'المستخدم' : 'User',
          isArabic ? 'الدور' : 'Role',
          isArabic ? 'الإجراء' : 'Action',
          isArabic ? 'النوع' : 'Entity',
          isArabic ? 'المعرف' : 'Entity ID',
          isArabic ? 'النتيجة' : 'Result',
          isArabic ? 'عنوان IP' : 'IP Address',
        ]}>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDateTime(row.created_at)}</td>
              <td>{row.actor_name || row.actor_email || '-'}</td>
              <td>{row.actor_role || '-'}</td>
              <td>{row.action_code}</td>
              <td>{row.entity_type || '-'}</td>
              <td>{row.entity_id || '-'}</td>
              <td>{row.success ? (isArabic ? 'ناجح' : 'Success') : `${isArabic ? 'فشل' : 'Failed'} (${row.status_code || '-'})`}</td>
              <td>{row.ip_address || '-'}</td>
            </tr>
          )) : <tr><td colSpan={8} className="muted" style={{ textAlign: 'center' }}>{isArabic ? 'لا توجد سجلات مطابقة.' : 'No matching audit entries.'}</td></tr>}
        </Table>
      )}
    </div>
  );
}
