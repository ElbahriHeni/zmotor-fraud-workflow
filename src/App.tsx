import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import FraudQueuePage from './pages/cases/FraudQueuePage';
import CaseDetailsPage from './pages/cases/CaseDetailsPage';
import NewCaseWizardPage from './pages/cases/NewCaseWizardPage';
import ReportsPage from './pages/reports/ReportsPage';
import ReportDetailsPage from './pages/reports/ReportDetailsPage';
import AuditLogPage from './pages/audit/AuditLogPage';
import UsersListPage from './pages/users/UsersListPage';
import UserFormPage from './pages/users/UserFormPage';
import RolesListPage from './pages/roles/RolesListPage';
import RoleFormPage from './pages/roles/RoleFormPage';
import AccessDeniedPage from './pages/security/AccessDeniedPage';
import ChangePasswordPage from './pages/security/ChangePasswordPage';
import FraudAssessmentPage from './pages/assessment/FraudAssessmentPage';
import MotorFraudCasesPage from './pages/motor/MotorFraudCasesPage';
import MotorFraudCasePage from './pages/motor/MotorFraudCasePage';
import { hasPermission, PermissionRoute } from './security';
import { useAuth } from './AuthProvider';

function AuthLoadingScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">Secure Access</span>
        <h1 style={{ marginBottom: 8 }}>Checking session...</h1>
        <p className="muted" style={{ margin: 0 }}>Please wait while we verify your access.</p>
      </div>
    </div>
  );
}

function getDefaultAppPath(currentUser: ReturnType<typeof useAuth>['currentUser']) {
  if (hasPermission(currentUser, 'dashboard.view')) return '/app/dashboard';
  if (hasPermission(currentUser, 'cases.view')) return '/app/queue';
  if (hasPermission(currentUser, 'reports.view')) return '/app/reports';
  if (hasPermission(currentUser, 'fraud_assessment.view')) return '/app/fraud-assessment/01';
  if (hasPermission(currentUser, 'motor_fraud.view')) return '/app/motor-fraud';
  if (hasPermission(currentUser, 'users.view')) return '/app/users';
  if (hasPermission(currentUser, 'roles.view')) return '/app/roles';
  if (hasPermission(currentUser, 'audit.view')) return '/app/audit-log';
  return '/app/access-denied';
}

function RootRoute() {
  const { isAuthenticated, isAuthLoading, currentUser } = useAuth();
  if (isAuthLoading) return <AuthLoadingScreen />;
  return <Navigate to={isAuthenticated ? getDefaultAppPath(currentUser) : '/login'} replace />;
}

function AppIndexRoute() {
  const { currentUser } = useAuth();
  return <Navigate to={getDefaultAppPath(currentUser)} replace />;
}

function ProtectedApp() {
  const { isAuthenticated, isAuthLoading, currentUser } = useAuth();
  const location = useLocation();
  if (isAuthLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (currentUser?.mustChangePassword && location.pathname !== '/app/change-password') {
    return <Navigate to="/app/change-password" replace />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<ProtectedApp />}>
        <Route index element={<AppIndexRoute />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="dashboard" element={<PermissionRoute permission="dashboard.view"><DashboardPage /></PermissionRoute>} />
        <Route path="queue" element={<PermissionRoute permission="cases.view"><FraudQueuePage /></PermissionRoute>} />
        <Route path="cases/new" element={<PermissionRoute permission="cases.create"><NewCaseWizardPage /></PermissionRoute>} />
        <Route path="cases/:caseId" element={<PermissionRoute permission="cases.view"><CaseDetailsPage /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute permission="reports.view"><ReportsPage /></PermissionRoute>} />
        <Route path="reports/:reportName" element={<PermissionRoute permission="reports.view"><ReportDetailsPage /></PermissionRoute>} />
        <Route path="fraud-assessment/strategy-risk-appetite" element={<Navigate to="/app/fraud-assessment/01" replace />} />
        <Route path="fraud-assessment/:assessmentCode" element={<PermissionRoute permission="fraud_assessment.view"><FraudAssessmentPage /></PermissionRoute>} />
        <Route path="motor-fraud" element={<PermissionRoute permission="motor_fraud.view"><MotorFraudCasesPage /></PermissionRoute>} />
        <Route path="motor-fraud/new" element={<PermissionRoute permission="motor_fraud.create"><MotorFraudCasePage /></PermissionRoute>} />
        <Route path="motor-fraud/:caseId" element={<PermissionRoute permission="motor_fraud.view"><MotorFraudCasePage /></PermissionRoute>} />
        <Route path="audit-log" element={<PermissionRoute permission="audit.view"><AuditLogPage /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute permission="users.view"><UsersListPage /></PermissionRoute>} />
        <Route path="users/new" element={<PermissionRoute permission="users.create"><UserFormPage mode="create" /></PermissionRoute>} />
        <Route path="users/:userId" element={<PermissionRoute permission="users.view"><UserFormPage mode="details" /></PermissionRoute>} />
        <Route path="roles" element={<PermissionRoute permission="roles.view"><RolesListPage /></PermissionRoute>} />
        <Route path="roles/new" element={<PermissionRoute permission="roles.create"><RoleFormPage mode="create" /></PermissionRoute>} />
        <Route path="roles/:roleId" element={<PermissionRoute permission="roles.view"><RoleFormPage mode="details" /></PermissionRoute>} />
      </Route>
    </Routes>
  );
}
