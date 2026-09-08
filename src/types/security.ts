export type RoleSummary = {
  id: number;
  role_code: string;
  role_name: string;
  description?: string | null;
  is_system: boolean | number;
  is_active: boolean | number;
  permission_count?: number;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type RoleDetails = RoleSummary & {
  permission_codes: string[];
};

export type Permission = {
  id: number;
  permission_code: string;
  permission_name: string;
  module_name: string;
  description?: string | null;
};

export type UserSummary = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  mobile_number?: string | null;
  auth_provider?: string;
  external_oid?: string | null;
  role_id: number;
  role_code: string;
  role_name: string;
  is_active: boolean | number;
  must_change_password?: boolean | number;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserPermissionOverride = {
  permission_code: string;
  is_allowed: boolean;
};

export type UserDetails = UserSummary & {
  legacy_role?: string;
  role_description?: string | null;
  role_is_system?: boolean | number;
  role_is_active?: boolean | number;
  created_by?: string | null;
  updated_by?: string | null;
  permission_overrides: UserPermissionOverride[];
  effective_permissions: string[];
};
