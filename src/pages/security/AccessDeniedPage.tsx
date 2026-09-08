import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';

export default function AccessDeniedPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Access Denied"
        subtitle="Your current role does not have permission to open this page or perform this action."
      />
      <div className="card">
        <p className="muted">Contact a System Administrator if you believe you require this access.</p>
        <Link className="btn primary" to="/app/dashboard">Return to Dashboard</Link>
      </div>
    </div>
  );
}
