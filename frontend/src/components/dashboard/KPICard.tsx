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
      border: 'hover:border-indigo-500/50',
      glow: 'group-hover:shadow-indigo-500/10',
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      badge: 'text-indigo-400 bg-indigo-500/10',
    },
    emerald: {
      border: 'hover:border-emerald-500/50',
      glow: 'group-hover:shadow-emerald-500/10',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      badge: 'text-emerald-400 bg-emerald-500/10',
    },
    amber: {
      border: 'hover:border-amber-500/50',
      glow: 'group-hover:shadow-amber-500/10',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      badge: 'text-amber-400 bg-amber-500/10',
    },
    rose: {
      border: 'hover:border-rose-500/50',
      glow: 'group-hover:shadow-rose-500/10',
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      badge: 'text-rose-400 bg-rose-500/10',
    },
    sky: {
      border: 'hover:border-sky-500/50',
      glow: 'group-hover:shadow-sky-500/10',
      iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      badge: 'text-sky-400 bg-sky-500/10',
    },
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 rounded-2xl border border-slate-800 transition-all duration-200 group ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${variantStyles.border} shadow-lg ${variantStyles.glow}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className={`p-2.5 rounded-xl border ${variantStyles.iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-extrabold tracking-tight text-white">{value}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">{subtitle}</p>
    </div>
  );
};
