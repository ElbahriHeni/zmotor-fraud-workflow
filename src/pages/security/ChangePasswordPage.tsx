import { FormEvent, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { apiPost } from '../../api';
import { useAuth } from '../../AuthProvider';
import type { AppOutletContext } from '../../layout/AppLayout';

const copy = {
  en: {
    eyebrow: 'Account Security', title: 'Change Password', subtitle: 'Choose a new password for your local application account.',
    current: 'Current Password', next: 'New Password', confirm: 'Confirm New Password', save: 'Change Password', saving: 'Changing...',
    mismatch: 'The new passwords do not match.', success: 'Password changed successfully. Please sign in again.',
    adNotice: 'Your password is managed by Microsoft/Active Directory and cannot be changed in this application.',
  },
  ar: {
    eyebrow: 'أمان الحساب', title: 'تغيير كلمة المرور', subtitle: 'اختر كلمة مرور جديدة لحساب التطبيق المحلي.',
    current: 'كلمة المرور الحالية', next: 'كلمة المرور الجديدة', confirm: 'تأكيد كلمة المرور الجديدة', save: 'تغيير كلمة المرور', saving: 'جاري التغيير...',
    mismatch: 'كلمتا المرور الجديدتان غير متطابقتين.', success: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.',
    adNotice: 'تتم إدارة كلمة المرور من خلال Microsoft/Active Directory ولا يمكن تغييرها داخل التطبيق.',
  },
};

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { language, currentUser } = useOutletContext<AppOutletContext>();
  const { logout } = useAuth();
  const t = copy[language];
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isLocal = (currentUser?.authProvider || currentUser?.authMode || 'local') === 'local';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLocal) return;
    if (newPassword !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    try {
      setError('');
      setIsSaving(true);
      await apiPost<{ message: string }>('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      await logout();
      navigate('/login', { replace: true, state: { message: t.success } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-section security-admin-page">
      <div className="page-header">
        <div><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p className="muted">{t.subtitle}</p></div>
      </div>

      <form className="card security-form-card" onSubmit={submit}>
        {!isLocal ? <div className="notice-card">{t.adNotice}</div> : null}
        {error ? <div className="notice-card error">{error}</div> : null}
        <div className="form-grid single">
          <label>{t.current}<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required disabled={!isLocal} /></label>
          <label>{t.next}<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={10} required disabled={!isLocal} /></label>
          <label>{t.confirm}<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required disabled={!isLocal} /></label>
        </div>
        {isLocal ? <div className="page-actions"><button className="btn primary" type="submit" disabled={isSaving}>{isSaving ? t.saving : t.save}</button></div> : null}
      </form>
    </section>
  );
}
