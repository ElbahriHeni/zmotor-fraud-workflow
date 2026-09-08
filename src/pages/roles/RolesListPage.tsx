import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiGet } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import type { RoleSummary } from '../../types/security';

function isTrue(value: boolean | number | undefined) {
  return value === true || value === 1;
}

export default function RolesListPage() {
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const copy = useMemo(() => isArabic ? {
    title: 'إدارة الأدوار', subtitle: 'إنشاء الأدوار وتحديد الصلاحيات الممنوحة لكل دور.', add: 'إضافة دور',
    name: 'اسم الدور', code: 'رمز الدور', description: 'الوصف', permissions: 'عدد الصلاحيات', users: 'عدد المستخدمين', status: 'الحالة', actions: 'الإجراءات',
    active: 'نشط', inactive: 'غير نشط', system: 'دور نظام', custom: 'دور مخصص', open: 'فتح', loading: 'جاري التحميل...', noRows: 'لا توجد أدوار.',
  } : {
    title: 'Role Management', subtitle: 'Create roles and configure the permissions granted to each role.', add: 'Add Role',
    name: 'Role Name', code: 'Role Code', description: 'Description', permissions: 'Permissions', users: 'Users', status: 'Status', actions: 'Actions',
    active: 'Active', inactive: 'Inactive', system: 'System Role', custom: 'Custom Role', open: 'Open', loading: 'Loading roles...', noRows: 'No roles found.',
  }, [isArabic]);

  useEffect(() => {
    let mounted = true;
    apiGet<RoleSummary[]>('/api/admin/roles?includeInactive=true')
      .then((rows) => { if (mounted) setRoles(rows); })
      .catch((loadError) => { if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load roles.'); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader
        eyebrow={isArabic ? 'الأمن والصلاحيات' : 'Security & Access'}
        title={copy.title}
        subtitle={copy.subtitle}
        action={hasPermission(currentUser, 'roles.create') ? <Link className="btn primary" to="/app/roles/new">{copy.add}</Link> : undefined}
      />
      {error ? <div className="card error-message">{error}</div> : null}
      <Table headers={[copy.name, copy.code, copy.description, copy.permissions, copy.users, copy.status, copy.actions]}>
        {isLoading ? <tr><td colSpan={7}>{copy.loading}</td></tr> : roles.length === 0 ? <tr><td colSpan={7}>{copy.noRows}</td></tr> : roles.map((role) => (
          <tr key={role.id}>
            <td><strong>{role.role_name}</strong><div className="small muted">{isTrue(role.is_system) ? copy.system : copy.custom}</div></td>
            <td><code>{role.role_code}</code></td>
            <td>{role.description || '-'}</td>
            <td>{role.permission_count ?? 0}</td>
            <td>{role.user_count ?? 0}</td>
            <td><span className={`badge ${isTrue(role.is_active) ? 'low' : 'high'}`}>{isTrue(role.is_active) ? copy.active : copy.inactive}</span></td>
            <td><Link className="mini-btn primary" to={`/app/roles/${role.id}`}>{copy.open}</Link></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
