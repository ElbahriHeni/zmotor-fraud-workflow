import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { apiGet, apiPatch, apiPost, apiPut } from '../../api';
import type { AppOutletContext } from '../../layout/AppLayout';
import { hasPermission } from '../../security';
import type { Permission, RoleDetails } from '../../types/security';

interface Props { mode: 'create' | 'details'; }

function isTrue(value: boolean | number | undefined) {
  return value === true || value === 1;
}

export default function RoleFormPage({ mode }: Props) {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const isArabic = language === 'ar';
  const isCreate = mode === 'create';
  const [role, setRole] = useState<RoleDetails | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const copy = useMemo(() => isArabic ? {
    create: 'إضافة دور', details: 'تفاصيل الدور', subtitle: 'إدارة بيانات الدور والصلاحيات التابعة له.', code: 'رمز الدور', name: 'اسم الدور',
    description: 'الوصف', active: 'الدور نشط', permissions: 'صلاحيات الدور', save: 'حفظ الدور', update: 'تحديث الدور', cancel: 'إلغاء',
    loading: 'جاري التحميل...', fixed: 'صلاحيات مسؤول النظام ثابتة ولا يمكن تقليلها.', selectAll: 'تحديد الكل', clearAll: 'إلغاء الكل',
  } : {
    create: 'Add Role', details: 'Role Details', subtitle: 'Manage the role profile and its assigned permissions.', code: 'Role Code', name: 'Role Name',
    description: 'Description', active: 'Role is active', permissions: 'Role Permissions', save: 'Save Role', update: 'Update Role', cancel: 'Cancel',
    loading: 'Loading...', fixed: 'System Administrator permissions are fixed and cannot be reduced.', selectAll: 'Select All', clearAll: 'Clear All',
  }, [isArabic]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setIsLoading(true);
        const permissionRows = await apiGet<Permission[]>('/api/admin/permissions');
        if (!mounted) return;
        setPermissions(permissionRows);
        if (!isCreate && roleId) {
          const roleRow = await apiGet<RoleDetails>(`/api/admin/roles/${roleId}`);
          if (!mounted) return;
          setRole(roleRow);
          setRoleCode(roleRow.role_code);
          setRoleName(roleRow.role_name);
          setDescription(roleRow.description || '');
          setIsActive(isTrue(roleRow.is_active));
          setSelectedPermissions(new Set(roleRow.permission_codes || []));
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Failed to load role.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [isCreate, roleId]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    permissions.forEach((permission) => {
      const items = groups.get(permission.module_name) ?? [];
      items.push(permission);
      groups.set(permission.module_name, items);
    });
    return Array.from(groups.entries());
  }, [permissions]);

  const isSystemAdministrator = role?.role_code === 'SYSTEM_ADMIN';
  const canEditDetails = isCreate ? hasPermission(currentUser, 'roles.create') : hasPermission(currentUser, 'roles.update');
  const canEditPermissions = hasPermission(currentUser, 'roles.manage_permissions') && !isSystemAdministrator;

  const togglePermission = (code: string) => {
    if (!canEditPermissions && !isCreate) return;
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true); setError(''); setMessage('');
      if (isCreate) {
        const created = await apiPost<RoleDetails>('/api/admin/roles', { role_code: roleCode, role_name: roleName, description: description || null });
        if (selectedPermissions.size > 0 && hasPermission(currentUser, 'roles.manage_permissions')) {
          await apiPut(`/api/admin/roles/${created.id}/permissions`, { permission_codes: Array.from(selectedPermissions) });
        }
        navigate(`/app/roles/${created.id}`, { replace: true });
        return;
      }
      if (!roleId) return;
      const updated = await apiPatch<RoleDetails>(`/api/admin/roles/${roleId}`, { role_name: roleName, description: description || null, is_active: isActive });
      if (canEditPermissions) {
        const withPermissions = await apiPut<RoleDetails>(`/api/admin/roles/${roleId}/permissions`, { permission_codes: Array.from(selectedPermissions) });
        setRole(withPermissions);
      } else {
        setRole(updated);
      }
      setMessage('Role updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save role.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="card">{copy.loading}</div>;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      <PageHeader eyebrow={isArabic ? 'الأمن والصلاحيات' : 'Security & Access'} title={isCreate ? copy.create : `${copy.details} - ${roleName}`} subtitle={copy.subtitle} />
      {message ? <div className="card success-message">{message}</div> : null}
      {error ? <div className="card error-message">{error}</div> : null}
      <form onSubmit={submit}>
        <div className="card security-section">
          <div className="form-grid two-col-form">
            <label><span>{copy.code}</span><input required disabled={!isCreate || !canEditDetails} value={roleCode} onChange={(e) => setRoleCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_'))} /></label>
            <label><span>{copy.name}</span><input required disabled={!canEditDetails} value={roleName} onChange={(e) => setRoleName(e.target.value)} /></label>
            <label style={{ gridColumn: '1 / -1' }}><span>{copy.description}</span><textarea rows={3} disabled={!canEditDetails} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            {!isCreate ? <label className="checkbox-row"><input type="checkbox" disabled={!canEditDetails || isSystemAdministrator} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /><span>{copy.active}</span></label> : null}
          </div>
        </div>

        <div className="card security-section top-gap">
          <div className="security-section-heading"><div><h3>{copy.permissions}</h3>{isSystemAdministrator ? <p className="muted">{copy.fixed}</p> : null}</div>{canEditPermissions ? <div className="actions-inline"><button className="mini-btn" type="button" onClick={() => setSelectedPermissions(new Set(permissions.map((item) => item.permission_code)))}>{copy.selectAll}</button><button className="mini-btn" type="button" onClick={() => setSelectedPermissions(new Set())}>{copy.clearAll}</button></div> : null}</div>
          <div className="permission-card-grid">
            {groupedPermissions.map(([moduleName, modulePermissions]) => <div className="permission-module card" key={moduleName}><h4>{moduleName}</h4>{modulePermissions.map((permission) => <label className="permission-checkbox" key={permission.permission_code}><input type="checkbox" disabled={isSystemAdministrator || !canEditPermissions} checked={isSystemAdministrator || selectedPermissions.has(permission.permission_code)} onChange={() => togglePermission(permission.permission_code)} /><span><strong>{permission.permission_name}</strong><small>{permission.permission_code}</small></span></label>)}</div>)}
          </div>
          <div className="actions-inline top-gap">
            {canEditDetails ? <button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? copy.loading : isCreate ? copy.save : copy.update}</button> : null}
            <button className="btn" type="button" onClick={() => navigate('/app/roles')}>{copy.cancel}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
