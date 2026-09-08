import type { Configuration, RedirectRequest } from '@azure/msal-browser';

export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || 'dev').toLowerCase();

export const AD_CLIENT_ID = import.meta.env.VITE_AD_CLIENT_ID || 'dev-client-id';
export const AD_TENANT_ID = import.meta.env.VITE_AD_TENANT_ID || 'common';
export const AD_SCOPE = import.meta.env.VITE_AD_SCOPE || `api://${AD_CLIENT_ID}/access_as_user`;

export const isAdAuthMode = AUTH_MODE === 'ad';

export const msalConfig: Configuration = {
  auth: {
    clientId: AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AD_TENANT_ID}`,
    redirectUri: `${window.location.origin}/login`,
    postLogoutRedirectUri: `${window.location.origin}/login`,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const loginRequest: RedirectRequest = {
  scopes: [AD_SCOPE],
};
