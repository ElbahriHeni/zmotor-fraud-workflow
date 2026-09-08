export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type CurrentUser = {
  id?: number | string;
  email: string;
  name: string;
  username?: string;
  mobileNumber?: string;
  role?: string;
  roleCode?: string;
  roleName?: string;
  roleId?: number;
  authMode?: string;
  authProvider?: string;
  groups?: string[];
  oid?: string;
  tenantId?: string;
  permissions?: string[];
  effectivePermissions?: string[];
  canManageSecurity?: boolean;
  tokenVersion?: number;
  mustChangePassword?: boolean;
};

export type LoginResponse = {
  token: string;
  user: CurrentUser;
};

export function setStoredAccessToken(token: string) {
  localStorage.setItem('access_token', token);
  sessionStorage.removeItem('access_token');
}

export function clearStoredAccessToken() {
  localStorage.removeItem('access_token');
  sessionStorage.removeItem('access_token');
}

type AccessTokenGetter = () => Promise<string | null>;

let accessTokenGetter: AccessTokenGetter | null = null;

export function setAccessTokenGetter(getter: AccessTokenGetter | null) {
  accessTokenGetter = getter;
}

async function getAccessToken() {
  const storedToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';

  if (accessTokenGetter) {
    const dynamicToken = await accessTokenGetter();
    return dynamicToken || storedToken;
  }

  return storedToken;
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorBody?.error || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Keep default error message.
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: await getAuthHeaders(),
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}


export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function apiUploadFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  });

  return handleResponse<T>(response);
}

export async function apiPostDownload(path: string, body: unknown, fallbackFilename: string): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorBody?.error || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Keep the default error message.
      }
    }
    throw new Error(errorMessage);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = fileNameMatch?.[1] || fallbackFilename;
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return filename;
}

export async function apiDownload(path: string, fallbackFilename: string): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorBody?.error || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Keep default error message.
      }
    }
    throw new Error(errorMessage);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = fileNameMatch?.[1] || fallbackFilename;
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return filename;
}
