import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { AuthProvider } from './AuthProvider';
import { msalConfig } from './msalConfig';
import './styles.css';

const authMode = import.meta.env.VITE_AUTH_MODE || 'local';
const isAdAuthMode = authMode === 'ad';

const appContent = (
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdAuthMode ? (
      <MsalProvider instance={new PublicClientApplication(msalConfig)}>
        {appContent}
      </MsalProvider>
    ) : (
      appContent
    )}
  </React.StrictMode>,
);