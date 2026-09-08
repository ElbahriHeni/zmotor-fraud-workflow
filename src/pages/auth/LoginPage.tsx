import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthProvider';

function AuthLoadingScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">Secure Access</span>
        <h1 style={{ marginBottom: 8 }}>Checking session...</h1>
        <p className="muted" style={{ margin: 0 }}>
          Please wait while we verify your access.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { authMode, currentUser, isAuthenticated, isAuthLoading, authError, login } = useAuth();
  const isAdMode = authMode === 'ad';
  const isLocalMode = authMode === 'local';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleLogin = async () => {
    try {
      setLocalError('');
      setIsSubmitting(true);

      if (isLocalMode) {
        await login({ email, password });
        navigate('/app/dashboard', { replace: true });
        return;
      }

      await login();

      if (!isAdMode) {
        navigate('/app/dashboard', { replace: true });
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <div className="auth-grid">
          <div className="auth-panel">
            <span className="eyebrow">Secure Access</span>
            <h1>Fraud operations, redesigned for clarity.</h1>
            <p>
              Enter the command center for queue triage, case investigations, fraud indicators,
              and reporting without the visual clutter of the previous version.
            </p>
            <div className="auth-points">
              <div className="auth-point">
                <strong>Controlled access</strong>
                <span>Only approved users with active accounts can access the system.</span>
              </div>
              <div className="auth-point">
                <strong>Draft ownership</strong>
                <span>Draft cases remain visible only to the user who created them.</span>
              </div>
              <div className="auth-point">
                <strong>Shared fraud workspace</strong>
                <span>Submitted cases, reports, and dashboards are visible to authorized users.</span>
              </div>
            </div>
          </div>
          <div className="auth-form">
            <div className="auth-form-header">
              <h2>Sign in</h2>
              <p className="muted">
                {isAdMode
                  ? 'Use your company account to access the fraud management portal.'
                  : isLocalMode
                    ? 'Use your approved email and password to access the fraud management portal.'
                    : 'Development mode is active. The backend will use the DEV_USER values from .env.'}
              </p>
            </div>

            {authError || localError ? (
              <div className="card" style={{ marginBottom: 16, color: '#b42318' }}>
                {localError || authError}
              </div>
            ) : null}

            <div className="form-grid single">
              {isLocalMode ? (
                <>
                  <label>
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@arabianshield.com"
                      autoComplete="username"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleLogin();
                        }
                      }}
                    />
                  </label>
                </>
              ) : null}

              {!isAdMode && !isLocalMode ? (
                <div className="card" style={{ background: 'rgba(248,250,252,0.9)' }}>
                  <span className="eyebrow">Development User</span>
                  <p style={{ marginBottom: 4 }}>
                    <strong>{currentUser?.name || 'Loaded from backend .env'}</strong>
                  </p>
                  <p className="muted" style={{ margin: 0 }}>{currentUser?.email || 'DEV_USER_EMAIL'}</p>
                </div>
              ) : null}

              <div className="auth-actions">
                <button
                  className="btn primary"
                  type="button"
                  onClick={handleLogin}
                  disabled={isSubmitting || (isLocalMode && (!email || !password))}
                >
                  {isSubmitting
                    ? 'Signing in...'
                    : isAdMode
                      ? 'Sign in with Microsoft'
                      : isLocalMode
                        ? 'Sign in'
                        : 'Continue in Development Mode'}
                </button>
              </div>

              <p className="muted" style={{ fontSize: 12 }}>
                {isAdMode
                  ? 'Your password is handled by Microsoft/Active Directory. The fraud system receives only a secure token.'
                  : isLocalMode
                    ? 'Access is restricted to approved active users only.'
                    : 'To test another draft owner locally, change DEV_USER_EMAIL in backend/.env and restart the backend.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
