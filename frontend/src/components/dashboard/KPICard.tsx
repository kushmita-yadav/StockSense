import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  variant?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'indigo',
  onClick,
}) => {
  const variantStyles = {
    indigo: {
      border: 'hover:border-brand-500/50',
      glow: 'group-hover:shadow-brand-500/10',
      iconBg: 'bg-brand-500/10 text-brand-700 border-brand-500/20',
      badge: 'text-brand-700 bg-brand-500/10',
    },
    emerald: {
      border: 'hover:border-sage-500/50',
      glow: 'group-hover:shadow-sage-500/10',
      iconBg: 'bg-sage-500/10 text-sage-700 border-sage-500/20',
      badge: 'text-sage-700 bg-sage-500/10',
    },
    amber: {
      border: 'hover:border-brand-400/50',
      glow: 'group-hover:shadow-brand-400/10',
      iconBg: 'bg-brand-400/10 text-brand-700 border-brand-400/20',
      badge: 'text-brand-700 bg-brand-400/10',
    },
    rose: {
      border: 'hover:border-clay-500/50',
      glow: 'group-hover:shadow-clay-500/10',
      iconBg: 'bg-clay-500/10 text-clay-700 border-clay-500/20',
      badge: 'text-clay-700 bg-clay-500/10',
    },
    sky: {
      border: 'hover:border-plum-500/50',
      glow: 'group-hover:shadow-plum-500/10',
      iconBg: 'bg-plum-500/10 text-plum-700 border-plum-500/20',
      badge: 'text-plum-700 bg-plum-500/10',
    },
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 rounded-2xl border border-biscuit transition-all duration-200 group ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${variantStyles.border} shadow-lg ${variantStyles.glow}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
        <div className={`p-2.5 rounded-xl border ${variantStyles.iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-extrabold tracking-tight text-ink">{value}</span>
      </div>
      <p className="text-xs text-muted mt-1.5 flex items-center gap-1.5">{subtitle}</p>
    </div>
  );
};
