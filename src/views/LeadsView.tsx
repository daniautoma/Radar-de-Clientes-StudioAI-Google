import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Upload,
  LayoutGrid,
  Table as TableIcon,
  Trash2,
  Phone,
  Globe,
  ExternalLink,
  Calendar,
  Star,
  CheckCircle,
} from 'lucide-react';
import { BusinessLead, LeadStatus } from '../types';
import {
  deleteLead,
  exportAllToJson,
  exportLeadsToCsv,
  importFromJson,
  saveLead,
} from '../services/db';
import { ScoreBadge } from '../components/ScoreBadge';
import { StatusBadge } from '../components/StatusBadge';

const PIPELINE_COLUMNS: Array<{ id: LeadStatus; label: string }> = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'analizado', label: 'Analizado' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'respondio', label: 'Respondió' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'cliente', label: 'Cliente Cerrado' },
  { id: 'descartado', label: 'Descartado' },
];

interface LeadsViewProps {
  leads: BusinessLead[];
  onOpenLead: (lead: BusinessLead) => void;
  onLeadsUpdated: () => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onOpenLead,
  onLeadsUpdated,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [nicheFilter, setNicheFilter] = useState<string>('all');

  // Obtener lista única de nichos
  const uniqueNiches = Array.from(
    new Set(leads.map((l) => l.primaryTypeDisplayName).filter(Boolean))
  ) as string[];

  // Filtrado reactivo
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (nicheFilter !== 'all' && lead.primaryTypeDisplayName !== nicheFilter)
      return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = lead.displayName.toLowerCase().includes(q);
      const matchAddr = lead.formattedAddress.toLowerCase().includes(q);
      const matchPhone = (lead.nationalPhoneNumber || '').includes(q);
      if (!matchName && !matchAddr && !matchPhone) return false;
    }
    return true;
  });

  const handleStatusChange = async (
    lead: BusinessLead,
    newStatus: LeadStatus
  ) => {
    const updated: BusinessLead = {
      ...lead,
      status: newStatus,
    };
    await saveLead(updated);
    onLeadsUpdated();
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar "${name}" de tus leads?`)) {
      await deleteLead(id);
      onLeadsUpdated();
    }
  };

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      alert('No hay leads para exportar con los filtros actuales.');
      return;
    }
    const csvContent = exportLeadsToCsv(filteredLeads);
    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_radar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    const jsonStr = await exportAllToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copia_seguridad_radar_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importFromJson(text);
        alert(`Se han importado ${res.leadsCount} leads correctamente.`);
        onLeadsUpdated();
      } catch (err: any) {
        alert('Error al importar el archivo: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Barra de Filtros y Acciones */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Mis Leads Guardados ({leads.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestión de pipeline de ventas, estado comercial y exportación.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Descargar tabla compatible con Excel o Google Sheets"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Copia de seguridad completa en JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Copia JSON</span>
            </button>

            <label className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Importar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            {/* Selector de Vista: Kanban / Tabla */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 ml-2">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tablero Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Vista Tabla"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, dirección o teléfono..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos los estados</option>
              {PIPELINE_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todos los nichos</option>
              {uniqueNiches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vista 1: Tablero Kanban por Estados */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = filteredLeads.filter(
              (l) => l.status === column.id
            );
            return (
              <div
                key={column.id}
                className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col max-h-[750px]"
              >
                {/* Cabecera de Columna */}
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 rounded-t-xl">
                  <span className="font-semibold text-xs text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{column.label}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Tarjetas del Tablero */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => onOpenLead(lead)}
                      className="p-3.5 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 cursor-pointer transition-all space-y-2.5 shadow-sm group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <h5 className="font-semibold text-xs text-white truncate group-hover:text-emerald-300 transition-colors">
                            {lead.displayName}
                          </h5>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {lead.primaryTypeDisplayName || 'Negocio local'}
                          </span>
                        </div>
                        <ScoreBadge
                          score={lead.opportunityScore}
                          isProvisional={lead.isProvisionalScore}
                          size="sm"
                        />
                      </div>

                      {/* Contacto rápido */}
                      <div className="text-[11px] text-slate-400 space-y-1">
                        {lead.nationalPhoneNumber && (
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{lead.nationalPhoneNumber}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                          {lead.hasOwnWebsite && lead.websiteUri ? (
                            <span className="text-slate-400 truncate max-w-[170px]">
                              {lead.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[10px]">
                              {lead.websiteTypeNote || 'Sin web'}
                            </span>
                          )}
                        </div>
                      </div>

                      {lead.nextActionDate && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>Seguimiento: {lead.nextActionDate}</span>
                        </div>
                      )}

                      {/* Selector de Cambio Rápido de Estado */}
                      <div
                        className="pt-2 border-t border-slate-800/80 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleStatusChange(
                              lead,
                              e.target.value as LeadStatus
                            )
                          }
                          className="bg-slate-950 text-[10px] text-slate-300 rounded px-1.5 py-0.5 border border-slate-800 focus:outline-none"
                        >
                          {PIPELINE_COLUMNS.map((col) => (
                            <option key={col.id} value={col.id}>
                              Mover a: {col.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id, lead.displayName)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          title="Eliminar lead"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {columnLeads.length === 0 && (
                    <div className="p-4 text-center text-[11px] text-slate-500 italic border border-dashed border-slate-800/80 rounded-lg">
                      Vacío
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista 2: Tabla Densa */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-semibold">
                <tr>
                  <th className="p-3">Negocio</th>
                  <th className="p-3">Estado CRM</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Web</th>
                  <th className="p-3">Próxima Acción</th>
                  <th className="p-3">Oportunidad</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => onOpenLead(lead)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-white truncate">
                        {lead.displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {lead.primaryTypeDisplayName || 'Local'} · {lead.formattedAddress}
                      </div>
                    </td>

                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          handleStatusChange(lead, e.target.value as LeadStatus)
                        }
                        className="bg-slate-950 border border-slate-800 text-[11px] rounded px-2 py-1 text-slate-300 focus:outline-none"
                      >
                        {PIPELINE_COLUMNS.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3 whitespace-nowrap font-mono text-slate-200">
                      {lead.nationalPhoneNumber || lead.internationalPhoneNumber || (
                        <span className="text-slate-500 italic text-[11px]">
                          Sin tlf.
                        </span>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {lead.hasOwnWebsite && lead.websiteUri ? (
                        <a
                          href={lead.websiteUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:underline max-w-[150px] truncate block"
                        >
                          {lead.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ) : (
                        <span className="text-amber-400 text-[11px]">
                          {lead.websiteTypeNote || 'Sin web'}
                        </span>
                      )}
                    </td>

                    <td className="p-3 whitespace-nowrap font-mono text-slate-400">
                      {lead.nextActionDate || '-'}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <ScoreBadge
                        score={lead.opportunityScore}
                        isProvisional={lead.isProvisionalScore}
                        size="sm"
                      />
                    </td>

                    <td
                      className="p-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleDelete(lead.id, lead.displayName)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Eliminar lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado Vacío */}
      {leads.length === 0 && (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-200">
            Aún no has guardado ningún lead
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Ve a la pantalla de Buscar, selecciona los negocios que más te interesen y pulsa «Guardar en mis leads» para organizarlos en tu pipeline de ventas.
          </p>
        </div>
      )}
    </div>
  );
};
