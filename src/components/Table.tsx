import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function Table({ headers, children, title, subtitle }: TableProps) {
  return (
    <div className="table-wrap card">
      {title || subtitle ? (
        <div className="table-title-row">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
