import React from 'react';
import { PageSpeedAudit } from '../types';
import { Smartphone, Zap, Search, ShieldCheck, CheckCircle } from 'lucide-react';

interface PageSpeedMeterProps {
  audit?: PageSpeedAudit;
  isLoading?: boolean;
}

export const PageSpeedMeter: React.FC<PageSpeedMeterProps> = ({
  audit,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-40 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-800 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!audit) {
    return null;
  }

  const getScoreColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    if (val >= 50) return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    return 'text-rose-400 border-rose-500/40 bg-rose-950/40';
  };

  const metrics = [
    {
      label: 'Rendimiento',
      value: audit.performance,
      icon: Zap,
      desc: 'Velocidad de carga en móviles',
    },
    {
      label: 'SEO',
      value: audit.seo,
      icon: Search,
      desc: 'Visibilidad en buscadores',
    },
    {
      label: 'Accesibilidad',
      value: audit.accessibility,
      icon: Smartphone,
      desc: 'Navegación táctil y lectores',
    },
    {
      label: 'Buenas Prácticas',
      value: audit.bestPractices,
      icon: ShieldCheck,
      desc: 'Seguridad y estándares web',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            Auditoría Google PageSpeed (Móvil)
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> 0-49 Crítico
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 50-89 Mejorable
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 90-100 Óptimo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const colorClass = getScoreColor(m.value);
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`p-3.5 rounded-lg border flex flex-col justify-between ${colorClass}`}
            >
              <div className="flex items-center justify-between text-xs opacity-90">
                <span className="font-medium">{m.label}</span>
                <Icon className="w-3.5 h-3.5 opacity-70" />
              </div>
              <div className="my-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono tabular-nums">
                  {m.value}
                </span>
                <span className="text-xs opacity-60">/ 100</span>
              </div>
              <p className="text-[11px] opacity-75 leading-tight">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {audit.screenshotBase64 && (
        <div className="mt-5 pt-4 border-t border-slate-800">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Captura real en dispositivo móvil (Lighthouse):
          </p>
          <div className="w-48 sm:w-56 rounded-lg border border-slate-700 overflow-hidden shadow-lg bg-black">
            <img
              src={audit.screenshotBase64}
              alt="Captura de la web del negocio en móvil"
              className="w-full h-auto object-cover max-h-72"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
};
