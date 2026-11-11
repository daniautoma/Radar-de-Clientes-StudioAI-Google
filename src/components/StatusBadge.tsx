import React from 'react';
import { LeadStatus } from '../types';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  nuevo: {
    label: 'Nuevo',
    bg: 'bg-slate-800/80',
    text: 'text-slate-300',
    border: 'border-slate-700',
  },
  analizado: {
    label: 'Analizado',
    bg: 'bg-indigo-950/70',
    text: 'text-indigo-300',
    border: 'border-indigo-800',
  },
  contactado: {
    label: 'Contactado',
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-800',
  },
  respondio: {
    label: 'Respondió',
    bg: 'bg-cyan-950/70',
    text: 'text-cyan-300',
    border: 'border-cyan-800',
  },
  reunion: {
    label: 'Reunión',
    bg: 'bg-purple-950/70',
    text: 'text-purple-300',
    border: 'border-purple-800',
  },
  cliente: {
    label: 'Cliente',
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-800',
  },
  descartado: {
    label: 'Descartado',
    bg: 'bg-zinc-900/80',
    text: 'text-zinc-400',
    border: 'border-zinc-800',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.nuevo;

  const sizeClasses =
    size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
};
