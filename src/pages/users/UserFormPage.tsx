import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiGet, apiPatch, apiPost, apiPut } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import type { Permission, RoleDetails, RoleSummary, UserDetails } from '../../types/security';

interface Props { mode: 'create' | 'details'; }
type OverrideValue = '' | 'allow' | 'deny';

type FormState = {
  full_name: string;
  username: string;
  email: string;
  mobile_number: string;
  role_id: string;
  auth_provider: 'local' | 'ad';
  external_oid: string;
  is_active: boolean;
  must_change_password: boolean;
  temporary_password: string;
  confirm_password: string;
};

const emptyForm: FormState = {
  full_name: '', username: '', email: '', mobile_number: '', role_id: '', auth_provider: 'local', external_oid: '',
  is_active: true, must_change_password: true, temporary_password: '', confirm_password: '',
};

function isTrue(value: boolean | number | undefined) {
  return value === true || value === 1;
}

export default function UserFormPage({ mode }: Props) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const isCreate = mode === 'create';
  const [form, setForm] = useState<FormState>(emptyForm);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDetails | null>(null);
  const [overrides, setOverrides] = useState<Record<string, OverrideValue>>({});
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const copy = useMemo(() => isArabic ? {
    titleCreate: 'إضافة مستخدم', titleEdit: 'تفاصيل المستخدم', subtitle: 'إدارة بيانات المستخدم والدور والصلاحيات المباشرة.',
    information: 'معلومات المستخدم', fullName: 'الاسم الكامل', username: 'اسم المستخدم', email: 'البريد الإلكتروني', mobile: 'رقم الجوال',
    role: 'الدور', authProvider: 'نوع المصادقة', local: 'محلي', ad: 'Microsoft AD', objectId: 'معرّف Microsoft Object ID',
    active: 'الحساب نشط', temporaryPassword: 'كلمة المرور المؤقتة', confirmPassword: 'تأكيد كلمة المرور', forceChange: 'إجبار المستخدم على تغيير كلمة المرور',
    save: 'حفظ المستخدم', update: 'تحديث المستخدم', cancel: 'إلغاء', permissions: 'استثناءات صلاحيات المستخدم',
    permissionsHelp: 'الافتراضي يرث صلاحيات الدور. السماح أو المنع يتجاوز إعداد الدور لهذا المستخدم فقط.', default: 'الافتراضي', allow: 'سماح', deny: 'منع',
    inherited: 'صلاحية الدور', module: 'الوحدة', permission: 'الصلاحية', override: 'الاستثناء', effective: 'النتيجة', yes: 'مسموح', no: 'غير مسموح',
    passwordReset: 'إعادة تعيين كلمة المرور', reset: 'إعادة التعيين', generateReset: 'إنشاء كلمة مرور مؤقتة وإعادة التعيين', generatedPassword: 'كلمة المرور المؤقتة الجديدة', copyPassword: 'نسخ كلمة المرور', displayOnce: 'تظهر كلمة المرور هذه مرة واحدة فقط. شاركها مع المستخدم بطريقة آمنة.', copied: 'تم نسخ كلمة المرور.', deactivate: 'إلغاء التفعيل', activate: 'تفعيل', loading: 'جاري التحميل...',
  } : {
    titleCreate: 'Add User', titleEdit: 'User Details', subtitle: 'Manage the user profile, assigned role, and direct permission overrides.',
    information: 'User Information', fullName: 'Full Name', username: 'Username', email: 'Email Address', mobile: 'Mobile Number', role: 'Role',
    authProvider: 'Authentication Provider', local: 'Local', ad: 'Microsoft AD', objectId: 'Microsoft Object ID', active: 'Account is active',
    temporaryPassword: 'Temporary Password', confirmPassword: 'Confirm Password', forceChange: 'Require password change at next login', save: 'Save User',
    update: 'Update User', cancel: 'Cancel', permissions: 'User Permission Overrides',
    permissionsHelp: 'Default inherits the role. Allow or Deny overrides the role for this user only.', default: 'Default', allow: 'Allow', deny: 'Deny',
    inherited: 'Role Access', module: 'Module', permission: 'Permission', override: 'Override', effective: 'Effective', yes: 'Allowed', no: 'Denied',
    passwordReset: 'Reset Password', reset: 'Reset Password', generateReset: 'Generate temporary password and reset', generatedPassword: 'New Temporary Password', copyPassword: 'Copy Password', displayOnce: 'This password is displayed once. Share it with the user through a secure channel.', copied: 'Password copied.', deactivate: 'Deactivate', activate: 'Activate', loading: 'Loading...',
  }, [isArabic]);

  useEffect(() => {
    let mounted = true;
    async function loadBase() {
      try {
        setIsLoading(true);
        const [roleRows, permissionRows] = await Promise.all([
          apiGet<RoleSummary[]>('/api/admin/roles?includeInactive=true'),
          apiGet<Permission[]>('/api/admin/permissions'),
        ]);
        if (!mounted) return;
        setRoles(roleRows);
        setPermissions(permissionRows);
        if (isCreate) {
          const defaultRole = roleRows.find((item) => item.role_code === 'FRAUD_INVESTIGATOR' && isTrue(item.is_active)) ?? roleRows.find((item) => isTrue(item.is_active));
          setForm((current) => ({ ...current, role_id: defaultRole ? String(defaultRole.id) : '' }));
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load security configuration.');
      } finally {
        if (mounted && isCreate) setIsLoading(false);
      }
    }
    loadBase();
    return () => { mounted = false; };
  }, [isCreate]);

  useEffect(() => {
    if (isCreate || !userId) return;
    let mounted = true;
    async function loadUser() {
      try {
        setIsLoading(true);
        const row = await apiGet<UserDetails>(`/api/admin/users/${userId}`);
        if (!mounted) return;
        setUser(row);
        setForm({
          full_name: row.full_name || '', username: row.username || '', email: row.email || '', mobile_number: row.mobile_number || '',
          role_id: String(row.role_id || ''), auth_provider: String(row.auth_provider || 'local').toLowerCase() === 'ad' ? 'ad' : 'local',
          external_oid: row.external_oid || '', is_active: isTrue(row.is_active), must_change_password: isTrue(row.must_change_password),
          temporary_password: '', confirm_password: '',
        });
        const nextOverrides: Record<string, OverrideValue> = {};
        for (const item of row.permission_overrides || []) nextOverrides[item.permission_code] = item.is_allowed ? 'allow' : 'deny';
        setOverrides(nextOverrides);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load user.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadUser();
    return () => { mounted = false; };
  }, [isCreate, userId]);

  useEffect(() => {
    if (!form.role_id) { setSelectedRole(null); return; }
    let mounted = true;
    apiGet<RoleDetails>(`/api/admin/roles/${form.role_id}`)
      .then((role) => { if (mounted) setSelectedRole(role); })
      .catch(() => { if (mounted) setSelectedRole(null); });
    return () => { mounted = false; };
  }, [form.role_id]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    permissions.forEach((permission) => {
      const items = groups.get(permission.module_name) ?? [];
      items.push(permission);
      groups.set(permission.module_name, items);
    });
    return Array.from(groups.entries());
  }, [permissions]);

  const isSystemAdministrator = selectedRole?.role_code === 'SYSTEM_ADMIN';
  const canEdit = isCreate ? hasPermission(currentUser, 'users.create') : hasPermission(currentUser, 'users.update');
  const canManageOverrides = !isCreate && hasPermission(currentUser, 'users.manage_permissions') && !isSystemAdministrator;

  const effectiveAllowed = (code: string) => {
    if (isSystemAdministrator) return true;
    const override = overrides[code] || '';
    if (override === 'allow') return true;
    if (override === 'deny') return false;
    return selectedRole?.permission_codes?.includes(code) ?? false;
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true); setError(''); setMessage('');
      if (!form.role_id) throw new Error('Please select a role.');
      if (isCreate && form.auth_provider === 'local') {
        if (form.temporary_password.length < 10) throw new Error('Temporary password must contain at least 10 characters.');
        if (form.temporary_password !== form.confirm_password) throw new Error('Password confirmation does not match.');
      }
      const payload = {
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        mobile_number: form.mobile_number || null,
        role_id: Number(form.role_id),
        auth_provider: form.auth_provider,
        external_oid: form.external_oid || null,
        must_change_password: form.must_change_password,
      };

      if (isCreate) {
        const created = await apiPost<UserDetails>('/api/admin/users', {
          ...payload,
          is_active: form.is_active,
          temporary_password: form.auth_provider === 'local' ? form.temporary_password : null,
        });
        navigate(`/app/users/${created.id}`, { replace: true });
        return;
      }

      if (!userId) return;
      const updated = await apiPatch<UserDetails>(`/api/admin/users/${userId}`, payload);
      setUser(updated);
      if (canManageOverrides) {
        const overridePayload = Object.entries(overrides)
          .filter(([, value]) => value !== '')
          .map(([permission_code, value]) => ({ permission_code, is_allowed: value === 'allow' }));
        const updatedPermissions = await apiPut<UserDetails>(`/api/admin/users/${userId}/permissions`, { overrides: overridePayload });
        setUser(updatedPermissions);
      }
      setMessage('User updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save user.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!userId || !user) return;
    try {
      setError(''); setMessage('');
      const updated = await apiPatch<UserDetails>(`/api/admin/users/${userId}/status`, { is_active: !isTrue(user.is_active) });
      setUser(updated);
      setForm((current) => ({ ...current, is_active: isTrue(updated.is_active) }));
      setMessage('User status updated successfully.');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update user status.');
    }
  };

  const handleResetPassword = async () => {
    if (!userId) return;
    try {
      setError(''); setMessage(''); setGeneratedPassword('');
      if (resetPassword.length < 10) throw new Error('Temporary password must contain at least 10 characters.');
      if (resetPassword !== confirmResetPassword) throw new Error('Password confirmation does not match.');
      await apiPost(`/api/admin/users/${userId}/reset-password`, { temporary_password: resetPassword, must_change_password: true });
      setResetPassword(''); setConfirmResetPassword('');
      setMessage('Password reset successfully. Existing login sessions were invalidated.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to reset password.');
    }
  };

  const handleGeneratePassword = async () => {
    if (!userId) return;
    try {
      setError(''); setMessage(''); setGeneratedPassword('');
      const response = await apiPost<{ temporary_password?: string; message: string }>(`/api/admin/users/${userId}/reset-password`, {
        generate_password: true,
        must_change_password: true,
      });
      if (!response.temporary_password) throw new Error('The server did not return the generated password.');
      setResetPassword(''); setConfirmResetPassword('');
      setGeneratedPassword(response.temporary_password);
      setMessage(response.message);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to generate a temporary password.');
    }
  };

  const copyGeneratedPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setMessage(copy.copied);
    } catch {
      setError('Copy failed. Select the displayed password and copy it manually.');
    }
  };

  if (isLoading) return <div className="card">{copy.loading}</div>;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader eyebrow={isArabic ? 'الأمن والصلاحيات' : 'Security & Access'} title={isCreate ? copy.titleCreate : `${copy.titleEdit} - ${user?.full_name || ''}`} subtitle={copy.subtitle} />
      {message ? <div className="card success-message">{message}</div> : null}
      {error ? <div className="card error-message">{error}</div> : null}

      <form onSubmit={submit}>
        <div className="card security-section">
          <h3>{copy.information}</h3>
          <div className="form-grid two-col-form">
            <label><span>{copy.fullName}</span><input required disabled={!canEdit} value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} /></label>
            <label><span>{copy.username}</span><input required disabled={!canEdit} value={form.username} onChange={(e) => updateField('username', e.target.value)} /></label>
            <label><span>{copy.email}</span><input type="email" required disabled={!canEdit} value={form.email} onChange={(e) => updateField('email', e.target.value)} /></label>
            <label><span>{copy.mobile}</span><input disabled={!canEdit} value={form.mobile_number} onChange={(e) => updateField('mobile_number', e.target.value)} /></label>
            <label><span>{copy.role}</span><select required disabled={!canEdit} value={form.role_id} onChange={(e) => updateField('role_id', e.target.value)}><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id} disabled={!isTrue(role.is_active)}>{role.role_name}{!isTrue(role.is_active) ? ' (Inactive)' : ''}</option>)}</select></label>
            <label><span>{copy.authProvider}</span><select disabled={!canEdit || !isCreate} value={form.auth_provider} onChange={(e) => updateField('auth_provider', e.target.value as 'local' | 'ad')}><option value="local">{copy.local}</option><option value="ad">{copy.ad}</option></select></label>
            {form.auth_provider === 'ad' ? <label><span>{copy.objectId}</span><input disabled={!canEdit} value={form.external_oid} onChange={(e) => updateField('external_oid', e.target.value)} /></label> : null}
            <label className="checkbox-row"><input type="checkbox" disabled={!canEdit || !isCreate} checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} /><span>{copy.active}</span></label>
            {isCreate && form.auth_provider === 'local' ? <><label><span>{copy.temporaryPassword}</span><input type="password" required value={form.temporary_password} onChange={(e) => updateField('temporary_password', e.target.value)} /></label><label><span>{copy.confirmPassword}</span><input type="password" required value={form.confirm_password} onChange={(e) => updateField('confirm_password', e.target.value)} /></label></> : null}
            {form.auth_provider === 'local' ? <label className="checkbox-row"><input type="checkbox" disabled={!canEdit} checked={form.must_change_password} onChange={(e) => updateField('must_change_password', e.target.checked)} /><span>{copy.forceChange}</span></label> : null}
          </div>
          <div className="actions-inline top-gap">
            {canEdit ? <button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? copy.loading : isCreate ? copy.save : copy.update}</button> : null}
            {!isCreate && hasPermission(currentUser, 'users.activate') ? <button className="btn" type="button" onClick={toggleStatus}>{isTrue(user?.is_active) ? copy.deactivate : copy.activate}</button> : null}
            <button className="btn" type="button" onClick={() => navigate('/app/users')}>{copy.cancel}</button>
          </div>
        </div>

        {!isCreate ? <div className="card security-section top-gap">
          <h3>{copy.permissions}</h3><p className="muted">{copy.permissionsHelp}</p>
          <div className="permission-matrix">
            {groupedPermissions.map(([moduleName, modulePermissions]) => <div className="permission-module" key={moduleName}><h4>{moduleName}</h4>{modulePermissions.map((permission) => {
              const inherited = isSystemAdministrator || selectedRole?.permission_codes?.includes(permission.permission_code);
              const allowed = effectiveAllowed(permission.permission_code);
              return <div className="permission-row" key={permission.permission_code}><div><strong>{permission.permission_name}</strong><span>{permission.permission_code}</span></div><span className={`badge ${inherited ? 'low' : 'high'}`}>{inherited ? copy.yes : copy.no}</span><select disabled={!canManageOverrides} value={overrides[permission.permission_code] || ''} onChange={(e) => setOverrides((current) => ({ ...current, [permission.permission_code]: e.target.value as OverrideValue }))}><option value="">{copy.default}</option><option value="allow">{copy.allow}</option><option value="deny">{copy.deny}</option></select><span className={`badge ${allowed ? 'low' : 'high'}`}>{allowed ? copy.yes : copy.no}</span></div>;
            })}</div>)}
          </div>
          {canManageOverrides ? <div className="actions-inline top-gap"><button className="btn primary" type="submit" disabled={isSaving}>{copy.update}</button></div> : null}
        </div> : null}
      </form>

      {!isCreate && form.auth_provider === 'local' && hasPermission(currentUser, 'users.reset_password') ? <div className="card security-section top-gap">
        <h3>{copy.passwordReset}</h3>
        <p className="muted">{isArabic ? 'لا يمكن استرجاع كلمة المرور القديمة. يمكن للمسؤول فقط تعيين كلمة مرور مؤقتة جديدة.' : 'The old password cannot be recovered. An administrator can only replace it with a new temporary password.'}</p>
        <div className="form-grid two-col-form"><label><span>{copy.temporaryPassword}</span><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></label><label><span>{copy.confirmPassword}</span><input type="password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} /></label></div>
        <div className="actions-inline top-gap">
          <button className="btn" type="button" onClick={handleResetPassword}>{copy.reset}</button>
          <button className="btn primary" type="button" onClick={handleGeneratePassword}>{copy.generateReset}</button>
        </div>
        {generatedPassword ? <div className="generated-password-card top-gap">
          <div><strong>{copy.generatedPassword}</strong><p className="muted">{copy.displayOnce}</p></div>
          <code>{generatedPassword}</code>
          <button className="btn" type="button" onClick={copyGeneratedPassword}>{copy.copyPassword}</button>
        </div> : null}
      </div> : null}
    </div>
  );
}
