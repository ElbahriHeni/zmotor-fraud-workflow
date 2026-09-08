import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import Table from '../../components/Table';
import { apiGet, apiPatch } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import type { RoleSummary, UserSummary } from '../../types/security';

function isTrue(value: boolean | number | undefined) {
  return value === true || value === 1;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function UsersListPage() {
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const copy = useMemo(() => isArabic ? {
    title: 'إدارة المستخدمين', subtitle: 'إنشاء المستخدمين وتعديلهم وإدارة الأدوار وحالة التفعيل.', add: 'إضافة مستخدم',
    search: 'البحث بالاسم أو اسم المستخدم أو البريد', allRoles: 'جميع الأدوار', allStatuses: 'جميع الحالات',
    active: 'نشط', inactive: 'غير نشط', name: 'الاسم الكامل', username: 'اسم المستخدم', email: 'البريد الإلكتروني',
    role: 'الدور', auth: 'نوع الدخول', status: 'الحالة', lastLogin: 'آخر دخول', actions: 'الإجراءات', open: 'فتح',
    activate: 'تفعيل', deactivate: 'إلغاء التفعيل', loading: 'جاري تحميل المستخدمين...', noRows: 'لا يوجد مستخدمون.',
  } : {
    title: 'User Management', subtitle: 'Create users, edit profiles, assign roles, and control account activation.', add: 'Add User',
    search: 'Search by name, username, or email', allRoles: 'All Roles', allStatuses: 'All Statuses', active: 'Active', inactive: 'Inactive',
    name: 'Full Name', username: 'Username', email: 'Email Address', role: 'Role', auth: 'Authentication', status: 'Status',
    lastLogin: 'Last Login', actions: 'Actions', open: 'Open', activate: 'Activate', deactivate: 'Deactivate',
    loading: 'Loading users...', noRows: 'No users found.',
  }, [isArabic]);

  const loadRoles = useCallback(async () => {
    try {
      const rows = await apiGet<RoleSummary[]>('/api/admin/roles?includeInactive=false');
      setRoles(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load roles.');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleId) params.set('roleId', roleId);
      if (status) params.set('status', status);
      const rows = await apiGet<UserSummary[]>(`/api/admin/users?${params.toString()}`);
      setUsers(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [roleId, search, status]);

  useEffect(() => { loadRoles(); }, [loadRoles]);
  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const changeStatus = async (user: UserSummary) => {
    try {
      setError('');
      setMessage('');
      const nextStatus = !isTrue(user.is_active);
      await apiPatch(`/api/admin/users/${user.id}/status`, { is_active: nextStatus });
      setMessage(nextStatus ? 'User activated successfully.' : 'User deactivated successfully.');
      await loadUsers();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update user status.');
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader
        eyebrow={isArabic ? 'الأمن والصلاحيات' : 'Security & Access'}
        title={copy.title}
        subtitle={copy.subtitle}
        action={hasPermission(currentUser, 'users.create') ? <Link className="btn primary" to="/app/users/new">{copy.add}</Link> : undefined}
      />

      {message ? <div className="card success-message">{message}</div> : null}
      {error ? <div className="card error-message">{error}</div> : null}

      <div className="card security-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} />
        <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
          <option value="">{copy.allRoles}</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{copy.allStatuses}</option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
      </div>

      <Table headers={[copy.name, copy.username, copy.email, copy.role, copy.auth, copy.status, copy.lastLogin, copy.actions]}>
        {isLoading ? (
          <tr><td colSpan={8}>{copy.loading}</td></tr>
        ) : users.length === 0 ? (
          <tr><td colSpan={8}>{copy.noRows}</td></tr>
        ) : users.map((user) => (
          <tr key={user.id}>
            <td>{user.full_name}</td>
            <td>{user.username || '-'}</td>
            <td>{user.email}</td>
            <td>{user.role_name || user.role_code}</td>
            <td>{String(user.auth_provider || 'local').toUpperCase()}</td>
            <td><span className={`badge ${isTrue(user.is_active) ? 'low' : 'high'}`}>{isTrue(user.is_active) ? copy.active : copy.inactive}</span></td>
            <td>{formatDate(user.last_login_at)}</td>
            <td>
              <div className="actions-inline">
                <Link className="mini-btn primary" to={`/app/users/${user.id}`}>{copy.open}</Link>
                {hasPermission(currentUser, 'users.activate') ? (
                  <button className="mini-btn" type="button" onClick={() => changeStatus(user)}>
                    {isTrue(user.is_active) ? copy.deactivate : copy.activate}
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
