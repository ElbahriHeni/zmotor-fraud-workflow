import { Link } from 'react-router-dom';

const widgets = [
  {
    title: 'Fraud App',
    description: 'Queue review, case investigation, and reporting workspace.',
    to: '/login',
    accentClass: 'fraud',
  },
  {
    title: 'Claims Hub',
    description: 'Coming soon',
    to: '#',
    accentClass: 'claims',
    disabled: true,
  },
  {
    title: 'Compliance Desk',
    description: 'Coming soon',
    to: '#',
    accentClass: 'compliance',
    disabled: true,
  },
];

export default function LauncherPage() {
  return (
    <div className="launcher-shell">
      <div className="launcher-frame">
        <div className="launcher-header">
          <span className="eyebrow">Apps</span>
          <h1>Choose a workspace</h1>
          <p className="muted">Open one of the available app widgets to continue.</p>
        </div>
        <div className="launcher-grid">
          {widgets.map((widget) => (
            widget.disabled ? (
              <div className={`card launcher-card ${widget.accentClass} disabled`} key={widget.title}>
                <span className="launcher-icon">{widget.title.slice(0, 2).toUpperCase()}</span>
                <h3>{widget.title}</h3>
                <p className="muted">{widget.description}</p>
                <span className="launcher-disabled">Not available</span>
              </div>
            ) : (
              <Link className={`card launcher-card ${widget.accentClass}`} to={widget.to} key={widget.title}>
                <span className="launcher-icon">{widget.title.slice(0, 2).toUpperCase()}</span>
                <h3>{widget.title}</h3>
                <p className="muted">{widget.description}</p>
                <span className="text-link">Open App</span>
              </Link>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
