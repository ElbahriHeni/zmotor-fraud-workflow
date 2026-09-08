import { KpiCard } from '../types';

const cardIcons = ['A', 'N', 'I', 'C', 'Q', 'H'];

interface StatCardProps extends KpiCard {
  trendLabel?: string;
}

export default function StatCard({ title, value, subtitle, trendLabel = 'Live workload snapshot' }: StatCardProps) {
  const icon = cardIcons[title.length % cardIcons.length];

  return (
    <div className="card stat-card">
      <div className="stat-card-header">
        <div className="muted small">{title}</div>
        <span className="stat-card-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle ? <div className="muted small">{subtitle}</div> : null}
      <div className="stat-trend">{trendLabel}</div>
    </div>
  );
}
