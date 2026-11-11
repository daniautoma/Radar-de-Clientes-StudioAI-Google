import React, { useState } from 'react';
import { ScoreItem } from '../types';
import { Info } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  isProvisional?: boolean;
  breakdown?: ScoreItem[];
  size?: 'sm' | 'md' | 'lg';
  showBreakdownButton?: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  isProvisional = false,
  breakdown = [],
  size = 'md',
  showBreakdownButton = false,
}) => {
  const [showModal, setShowModal] = useState(false);

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';
  let tierLabel = 'Baja';

  if (score >= 75) {
    colorClasses =
      'bg-emerald-950/70 text-emerald-300 border-emerald-800/80 dark:bg-emerald-950/60';
    dotColor = 'bg-emerald-400';
    tierLabel = 'Alta';
  } else if (score >= 45) {
    colorClasses =
      'bg-amber-950/60 text-amber-300 border-amber-800/80 dark:bg-amber-950/50';
    dotColor = 'bg-amber-400';
    tierLabel = 'Media';
  } else {
    colorClasses =
      'bg-rose-950/60 text-rose-300 border-rose-800/80 dark:bg-rose-950/50';
    dotColor = 'bg-rose-400';
    tierLabel = 'Baja';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5 font-medium',
  }[size];

  return (
    <>
      <div
        className={`inline-flex items-center rounded-md border font-mono tabular-nums ${colorClasses} ${sizeClasses}`}
        title={`Oportunidad: ${score}/100 (${tierLabel}) ${
          isProvisional ? '- Estimación provisional' : '- Auditoría completa'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="font-semibold">{score}</span>
        <span className="text-[10px] opacity-75 font-sans uppercase tracking-wider">
          {tierLabel}
        </span>
        {isProvisional && (
          <span className="text-[10px] font-sans opacity-60">(prov.)</span>
        )}

        {showBreakdownButton && breakdown.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowModal(true);
            }}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded"
            title="Ver desglose de puntuación"
          >
            <Info className="w-3 h-3" />
          </button>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-semibold text-slate-100">
                  Desglose de Oportunidad
                </h4>
                <p className="text-xs text-slate-400">
                  {isProvisional
                    ? 'Puntuación estimada según datos de Google Places'
                    : 'Puntuación consolidada con auditoría web y PageSpeed'}
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-md text-sm font-mono font-bold border ${colorClasses}`}
              >
                {score} / 100
              </div>
            </div>

            <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
              {breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-800/50 text-xs"
                >
                  <span className="text-slate-300 pr-2">{item.label}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      item.points > 0
                        ? 'text-emerald-400'
                        : item.points < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.points > 0 ? `+${item.points}` : item.points} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
