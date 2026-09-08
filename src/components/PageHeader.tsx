interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle, action, eyebrow = 'Workspace' }: Props) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
