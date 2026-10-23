import React from 'react';
import type { Wallet } from 'lucide-react';

export function StatCard({
  label,
  value,
  detail,
  Icon,
  tone = 'green',
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  Icon: typeof Wallet;
  tone?: string;
}): React.ReactElement {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <p>{label}</p>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}
