import React from 'react';
import {
  Search,
  Radar,
  Users,
  Settings,
  Building2,
  Sun,
  Moon,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { AppSettings } from '../types';

export type NavView = 'search' | 'detail' | 'niches' | 'leads' | 'settings';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  savedLeadsCount: number;
  settings: AppSettings;
  onToggleTheme: () => void;
  selectedLeadName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  savedLeadsCount,
  settings,
  onToggleTheme,
  selectedLeadName,
}) => {
  const counter = settings.placesApiCounter;
  const isOverLimit = counter.count >= counter.limitAlert;
  const pctUsed = Math.min(100, Math.round((counter.count / (counter.limitAlert || 800)) * 100));

  const navItems = [
    {
      id: 'search' as const,
      label: 'Buscar',
      icon: Search,
      description: 'Explorador en Google Maps',
    },
    {
      id: 'niches' as const,
      label: 'Radar de Nichos',
      icon: Radar,
      description: 'Comparativa de sectores',
    },
    {
      id: 'leads' as const,
      label: 'Mis Leads',
      icon: Users,
      badge: savedLeadsCount > 0 ? savedLeadsCount : undefined,
      description: 'Pipeline y CRM local',
    },
    {
      id: 'settings' as const,
      label: 'Ajustes',
      icon: Settings,
      description: 'Clave Cloud y vendedor',
    },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-between border-r border-slate-800 bg-slate-900/95 text-slate-200">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                Radar de Clientes
              </h1>
              <p className="text-[11px] text-slate-400">
                Prospección local B2B
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <div>
                    <span className="block leading-none">{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5 block">
                      {item.description}
                    </span>
                  </div>
                </div>

                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Ficha Activa (si hay negocio seleccionado) */}
          {selectedLeadName && (
            <button
              type="button"
              onClick={() => onNavigate('detail')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'detail'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 text-left truncate">
                <Building2 className={`w-4 h-4 shrink-0 ${currentView === 'detail' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div className="truncate">
                  <span className="block leading-none truncate">Ficha Negocio</span>
                  <span className="text-[10px] text-emerald-400 font-normal mt-0.5 block truncate">
                    {selectedLeadName}
                  </span>
                </div>
              </div>
            </button>
          )}
        </nav>
      </div>

      {/* Footer Status & Settings */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {/* Places API Usage Widget */}
        <div
          className={`p-3 rounded-lg border text-xs ${
            isOverLimit
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium flex items-center gap-1.5">
              {isOverLimit && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
              Cuota Places ({counter.monthYear})
            </span>
            <span className="font-mono text-[11px] font-semibold tabular-nums">
              {counter.count} / {counter.limitAlert}
            </span>
          </div>

          <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isOverLimit
                  ? 'bg-rose-500'
                  : pctUsed >= 80
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${pctUsed}%` }}
            />
          </div>

          <p className="text-[10px] text-slate-400 mt-1.5">
            {isOverLimit
              ? '¡Atención! Has alcanzado el límite mensual recomendado.'
              : `${counter.limitAlert - counter.count} llamadas restantes antes del aviso.`}
          </p>
        </div>

        {/* Theme Toggle & User Info */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400 truncate">
            <span className="block text-slate-300 font-medium truncate">
              {settings.sellerProfile.name}
            </span>
            <span className="text-[10px] truncate block opacity-75">
              {settings.sellerProfile.agencyName}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={settings.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-300" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
