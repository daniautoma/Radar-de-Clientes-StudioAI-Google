import React from 'react';
import { KeyRound, ArrowRight } from 'lucide-react';

interface ApiKeyWarningBannerProps {
  onGoToSettings: () => void;
  onOpenModal?: () => void;
}

export const ApiKeyWarningBanner: React.FC<ApiKeyWarningBannerProps> = ({
  onGoToSettings,
  onOpenModal,
}) => {
  return (
    <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-100">
            Clave de Google Cloud requerida para buscar negocios reales
          </h4>
          <p className="text-xs text-amber-300/80 mt-0.5 max-w-2xl leading-relaxed">
            Para consultar Google Places API (New) y Google PageSpeed Insights v5 necesitas introducir tu API Key en este navegador. Se guardará de forma privada exclusivamente en tu equipo.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenModal || onGoToSettings}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>Pegar API Key aquí</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
