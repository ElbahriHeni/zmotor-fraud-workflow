import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthProvider';
import type { CurrentUser } from '../api';
import { hasPermission } from '../security';
import AssistantPanel from '../components/assistant/AssistantPanel';
import { FRAUD_ASSESSMENTS } from '../data/fraudAssessments';

export type AppLanguage = 'en' | 'ar';

export type AppOutletContext = {
  language: AppLanguage;
  currentUser: CurrentUser | null;
  isAuthLoading: boolean;
};

const copy: Record<
  AppLanguage,
  {
    brandTitle: string;
    brandSubtitle: string;
    dashboard: string;
    queue: string;
    reports: string;
    auditLog: string;
    users: string;
    roles: string;
    fraudAssessment: string;
    motorFraud: string;
    logout: string;
    languageButton: string;
    userAria: string;
    changePassword: string;
    authLoading: string;
    authUnavailable: string;
  }
> = {
  en: {
    brandTitle: 'Fraud Management',
    brandSubtitle: 'Investigation command center',
    dashboard: 'Dashboard',
    queue: 'Fraud Queue',
    reports: 'Reports',
    auditLog: 'Audit Log',
    users: 'User Management',
    roles: 'Role Management',
    fraudAssessment: 'Fraud Assessment',
    motorFraud: 'Motor Fraud',
    logout: 'Log Out',
    languageButton: 'العربية',
    userAria: 'Fraud Agent User profile',
    changePassword: 'Change Password',
    authLoading: 'Loading user...',
    authUnavailable: 'User unavailable',
  },
  ar: {
    brandTitle: 'إدارة الاحتيال',
    brandSubtitle: 'مركز قيادة التحقيق',
    dashboard: 'لوحة التحكم',
    queue: 'قائمة بلاغات الاحتيال',
    reports: 'التقارير',
    auditLog: 'سجل التدقيق',
    users: 'إدارة المستخدمين',
    roles: 'إدارة الأدوار',
    fraudAssessment: 'تقييم الاحتيال',
    motorFraud: 'احتيال المركبات',
    logout: 'تسجيل الخروج',
    languageButton: 'English',
    userAria: 'ملف مستخدم فريق الاحتيال',
    changePassword: 'تغيير كلمة المرور',
    authLoading: 'جاري تحميل المستخدم...',
    authUnavailable: 'المستخدم غير متاح',
  },
};

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isAuthLoading, logout } = useAuth();
  const [assessmentExpanded, setAssessmentExpanded] = useState(() => location.pathname.startsWith('/app/fraud-assessment'));
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('app-language');
    return saved === 'ar' ? 'ar' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = useMemo(() => copy[language], [language]);

  const canViewAssessment = hasPermission(currentUser, 'fraud_assessment.view');
  const assessmentIsActive = location.pathname.startsWith('/app/fraud-assessment');

  useEffect(() => {
    if (assessmentIsActive) setAssessmentExpanded(true);
  }, [assessmentIsActive]);

  const links = useMemo(() => {
    const navigation: Array<{ to: string; label: string; position: 'beforeAssessment' | 'afterAssessment' }> = [];

    if (hasPermission(currentUser, 'dashboard.view')) navigation.push({ to: '/app/dashboard', label: t.dashboard, position: 'beforeAssessment' });
    if (hasPermission(currentUser, 'cases.view')) navigation.push({ to: '/app/queue', label: t.queue, position: 'beforeAssessment' });
    if (hasPermission(currentUser, 'motor_fraud.view')) navigation.push({ to: '/app/motor-fraud', label: t.motorFraud, position: 'afterAssessment' });
    if (hasPermission(currentUser, 'reports.view')) navigation.push({ to: '/app/reports', label: t.reports, position: 'afterAssessment' });
    if (hasPermission(currentUser, 'users.view')) navigation.push({ to: '/app/users', label: t.users, position: 'afterAssessment' });
    if (hasPermission(currentUser, 'roles.view')) navigation.push({ to: '/app/roles', label: t.roles, position: 'afterAssessment' });
    if (hasPermission(currentUser, 'audit.view')) navigation.push({ to: '/app/audit-log', label: t.auditLog, position: 'afterAssessment' });

    return navigation;
  }, [currentUser, t]);

  const userInitials = useMemo(() => {
    const source = currentUser?.name || currentUser?.email || 'FA';
    const initials = source
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    return initials || 'FA';
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-shell ${language === 'ar' ? 'rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <Link className="brand" to="/app/dashboard">
          <span className="brand-mark">FM</span>
          <span className="brand-copy">
            <strong>{t.brandTitle}</strong>
            <span>{t.brandSubtitle}</span>
          </span>
        </Link>

        <nav className="nav-links">
          {links.filter((link) => link.position === 'beforeAssessment').map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {link.label}
            </NavLink>
          ))}

          {canViewAssessment ? (
            <div className={`nav-group ${assessmentIsActive ? 'active' : ''}`}>
              <button
                type="button"
                className={`nav-group-button ${assessmentIsActive ? 'active' : ''}`}
                onClick={() => setAssessmentExpanded((current) => !current)}
                aria-expanded={assessmentExpanded}
              >
                <span className="nav-group-label">{t.fraudAssessment}</span>
                <span className={`nav-group-chevron ${assessmentExpanded ? 'expanded' : ''}`}>⌄</span>
              </button>
              {assessmentExpanded ? (
                <div className="nav-sub-links">
                  {FRAUD_ASSESSMENTS.map((assessment) => (
                    <NavLink
                      key={assessment.code}
                      to={`/app/fraud-assessment/${assessment.code}`}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      {assessment.menuTitle}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {links.filter((link) => link.position === 'afterAssessment').map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <div className="content-frame">
          <div className="topbar">
            <div className="topbar-controls">
              <button
                className="btn"
                type="button"
                onClick={() => setLanguage((prev) => (prev === 'en' ? 'ar' : 'en'))}
              >
                {t.languageButton}
              </button>

              <button className="btn" type="button" onClick={handleLogout}>
                {t.logout}
              </button>

              <button
                className="user-icon"
                type="button"
                aria-label={t.userAria}
                title={currentUser?.authProvider === 'local' ? t.changePassword : (isAuthLoading ? t.authLoading : currentUser?.email || t.authUnavailable)}
                onClick={() => {
                  if ((currentUser?.authProvider || currentUser?.authMode) === 'local') navigate('/app/change-password');
                }}
              >
                <span className="user-chip-avatar">{userInitials}</span>
              </button>
            </div>
          </div>

          <Outlet context={{ language, currentUser, isAuthLoading } satisfies AppOutletContext} />
        </div>
      </main>

      {hasPermission(currentUser, 'assistant.use') ? <AssistantPanel language={language} /> : null}
    </div>
  );
}
