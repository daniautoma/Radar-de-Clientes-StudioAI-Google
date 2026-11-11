import React from 'react';
import { NavView } from './Sidebar';
import { Settings, ShieldAlert, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentView: NavView;
  selectedLeadName?: string;
  hasApiKey: boolean;
  onNavigateToSettings: () => void;
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  search: {
    title: 'Buscar Negocios',
    subtitle: 'Exploración local con Places API (New)',
  },
  detail: {
    title: 'Ficha del Negocio',
    subtitle: 'Auditoría web, PageSpeed y propuesta comercial',
  },
  niches: {
    title: 'Radar de Nichos',
    subtitle: 'Comparador sectorial y oportunidades por mercado',
  },
  leads: {
    title: 'Mis Leads',
    subtitle: 'Gestión de pipeline comercial y seguimiento',
  },
  settings: {
    title: 'Ajustes y Configuración',
    subtitle: 'Google Cloud API Key y perfil del vendedor',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  selectedLeadName,
  hasApiKey,
  onNavigateToSettings,
}) => {
  const current = VIEW_TITLES[currentView] || VIEW_TITLES.search;

  return (
    <header className="h-16 px-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-6 shrink-0">
      {/* Zone 1 & 2: Breadcrumb / View Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-base font-semibold text-slate-100 whitespace-nowrap">
          {current.title}
        </h2>
        {selectedLeadName && currentView === 'detail' && (
          <>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono text-emerald-400 truncate max-w-xs">
              {selectedLeadName}
            </span>
          </>
        )}
        <span className="hidden md:inline-block text-slate-600">·</span>
        <span className="hidden md:inline-block text-xs text-slate-400 truncate">
          {current.subtitle}
        </span>
      </div>

      {/* Zone 3: Key Status & Quick Action */}
      <div className="flex items-center gap-3 shrink-0">
        {!hasApiKey ? (
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Configurar Google Cloud API Key</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px]">Google Cloud Conectado</span>
          </div>
        )}

        <button
          type="button"
          onClick={onNavigateToSettings}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Ajustes"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
