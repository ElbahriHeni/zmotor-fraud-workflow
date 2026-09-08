import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { CurrentUser } from './api';

export function hasPermission(user: CurrentUser | null | undefined, permission: string) {
  const permissions = user?.permissions ?? [];
  const roleCode = user?.roleCode ?? user?.role;
  return roleCode === 'SYSTEM_ADMIN' || permissions.includes('*') || permissions.includes(permission);
}

export function PermissionRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const { currentUser, isAuthLoading } = useAuth();

  if (isAuthLoading) return null;
  if (!hasPermission(currentUser, permission)) return <Navigate to="/app/access-denied" replace />;
  return <>{children}</>;
}

export function PermissionGate({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) {
  const { currentUser } = useAuth();
  return hasPermission(currentUser, permission) ? <>{children}</> : <>{fallback}</>;
}
