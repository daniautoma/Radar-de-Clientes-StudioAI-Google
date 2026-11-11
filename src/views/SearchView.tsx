import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  Star,
  CheckSquare,
  Square,
  BookmarkPlus,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Loader2,
  AlertCircle,
  X,
  Filter,
  KeyRound,
} from 'lucide-react';
import { AppSettings, BusinessLead } from '../types';
import { searchPlaces } from '../services/placesService';
import { runPageSpeedAudit } from '../services/pageSpeedService';
import { analyzeBusinessWithGemini } from '../services/geminiClient';
import { calculateFinalScore } from '../services/scoringEngine';
import { saveLead, saveLeads } from '../services/db';
import { ScoreBadge } from '../components/ScoreBadge';
import { ApiKeyWarningBanner } from '../components/ApiKeyWarningBanner';
import { ApiKeyModal } from '../components/ApiKeyModal';

const SUGGESTED_NICHES = [
  'talleres mecánicos',
  'clínicas dentales',
  'fisioterapeutas',
  'peluquerías',
  'centros de estética',
  'restaurantes',
  'gimnasios',
  'academias',
  'inmobiliarias',
  'reformas',
  'veterinarios',
  'autoescuelas',
  'ópticas',
  'gestorías',
];

interface SearchViewProps {
  hasApiKey: boolean;
  onGoToSettings: () => void;
  onOpenLead: (lead: BusinessLead) => void;
  onLeadsUpdated: () => void;
  onSettingsUpdated?: (updated: AppSettings) => void;
  initialLocation?: string;
  initialNiche?: string;
}

export const SearchView: React.FC<SearchViewProps> = ({
  hasApiKey,
  onGoToSettings,
  onOpenLead,
  onLeadsUpdated,
  onSettingsUpdated,
  initialLocation = 'Dos Hermanas, Sevilla',
  initialNiche = 'talleres mecánicos',
}) => {
  const [location, setLocation] = useState(initialLocation);
  const [niche, setNiche] = useState(initialNiche);

  // Modal rápido de clave API
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState<number>(0);
  const [filterMinReviews, setFilterMinReviews] = useState<number>(0);
  const [filterHideClosed, setFilterHideClosed] = useState(true);

  // Estado de resultados
  const [results, setResults] = useState<BusinessLead[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Proceso por lotes
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  const handleSearch = async (e?: React.FormEvent, customKey?: string) => {
    if (e) e.preventDefault();
    if (!location.trim() || !niche.trim()) return;

    if (!hasApiKey && !customKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSelectedIds(new Set());

    try {
      const res = await searchPlaces({
        location: location.trim(),
        niche: niche.trim(),
        apiKey: customKey,
      });
      setResults(res.leads);
      setNextPageToken(res.nextPageToken);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al realizar la búsqueda de negocios');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const res = await searchPlaces({
        location: location.trim(),
        niche: niche.trim(),
        pageToken: nextPageToken,
        skipCache: true,
      });

      // Evitar duplicados por ID
      const existingIds = new Set(results.map((r) => r.id));
      const newItems = res.leads.filter((l) => !existingIds.has(l.id));

      setResults((prev) => [...prev, ...newItems]);
      setNextPageToken(res.nextPageToken);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error al cargar más resultados');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Filtrado reactivo en cliente
  const filteredResults = results.filter((item) => {
    if (filterNoWebsite && item.hasOwnWebsite) return false;
    if (filterHasPhone && !item.nationalPhoneNumber && !item.internationalPhoneNumber) return false;
    if (filterMinRating > 0 && (item.rating || 0) < filterMinRating) return false;
    if (filterMinReviews > 0 && (item.userRatingCount || 0) < filterMinReviews) return false;
    if (
      filterHideClosed &&
      (item.businessStatus === 'CLOSED_TEMPORARILY' ||
        item.businessStatus === 'CLOSED_PERMANENTLY')
    ) {
      return false;
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleSaveSelected = async () => {
    const selected = results.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;

    await saveLeads(selected);
    onLeadsUpdated();
    alert(`Se han guardado ${selected.length} negocios en "Mis Leads".`);
  };

  // Analizar seleccionados de dos en dos como máximo
  const handleBatchAnalyze = async () => {
    const selected = results.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;

    setIsBatchAnalyzing(true);
    setBatchProgress({ current: 0, total: selected.length });

    const updatedMap = new Map<string, BusinessLead>();

    // Procesamos en lotes de 2 en paralelo
    const concurrency = 2;
    for (let i = 0; i < selected.length; i += concurrency) {
      const chunk = selected.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (lead) => {
          try {
            let updatedLead: BusinessLead = { ...lead };

            if (lead.hasOwnWebsite && lead.websiteUri) {
              // 1. Auditoría PageSpeed si tiene web
              try {
                const audit = await runPageSpeedAudit(lead.websiteUri);
                updatedLead.pageSpeedAudit = audit;
              } catch (auditErr) {
                console.warn('PageSpeed failed for lead:', lead.displayName, auditErr);
              }
            }

            // 2. Diagnóstico con Gemini
            try {
              const aiAnalysis = await analyzeBusinessWithGemini(
                updatedLead,
                updatedLead.pageSpeedAudit
              );
              updatedLead.aiAnalysis = aiAnalysis;
            } catch (aiErr) {
              console.warn('Gemini failed for lead:', lead.displayName, aiErr);
            }

            // 3. Recalcular puntuación final consolidada
            const { score, breakdown } = calculateFinalScore(updatedLead);
            updatedLead.opportunityScore = score;
            updatedLead.isProvisionalScore = false;
            updatedLead.scoreBreakdown = breakdown;
            updatedLead.status = 'analizado';

            // Guardar en base de datos
            await saveLead(updatedLead);
            updatedMap.set(updatedLead.id, updatedLead);
          } catch (itemErr) {
            console.error('Error analyzing lead:', lead.displayName, itemErr);
          } finally {
            setBatchProgress((prev) => ({
              current: Math.min((prev?.current || 0) + 1, selected.length),
              total: selected.length,
            }));
          }
        })
      );
    }

    // Actualizar resultados en memoria
    setResults((prev) =>
      prev.map((item) => (updatedMap.has(item.id) ? updatedMap.get(item.id)! : item))
    );

    setIsBatchAnalyzing(false);
    setBatchProgress(null);
    onLeadsUpdated();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Banner de API Key si no está configurada */}
      {!hasApiKey && (
        <ApiKeyWarningBanner
          onGoToSettings={onGoToSettings}
          onOpenModal={() => setShowApiKeyModal(true)}
        />
      )}

      {/* Formulario Principal de Búsqueda */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Zona (Ciudad, Municipio o Código Postal)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Dos Hermanas, Sevilla o 41700"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                Nicho / Categoría comercial
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ej. talleres mecánicos, clínicas dentales..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-colors ${
                  showFilters
                    ? 'bg-slate-800 border-slate-700 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Filtros avanzados"
              >
                <Filter className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={isLoading || isBatchAnalyzing}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sugerencias Rápidas de Nichos */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Sugerencias:</span>
            {SUGGESTED_NICHES.slice(0, 10).map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setNiche(sug)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  niche.toLowerCase() === sug.toLowerCase()
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Panel Desplegable de Filtros */}
          {showFilters && (
            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <input
                  type="checkbox"
                  checked={filterNoWebsite}
                  onChange={(e) => setFilterNoWebsite(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Solo sin web propia</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <input
                  type="checkbox"
                  checked={filterHasPhone}
                  onChange={(e) => setFilterHasPhone(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Solo con teléfono</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <input
                  type="checkbox"
                  checked={filterHideClosed}
                  onChange={(e) => setFilterHideClosed(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Ocultar cerrados</span>
              </label>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Valoración mín.:</span>
                <select
                  value={filterMinRating}
                  onChange={(e) => setFilterMinRating(Number(e.target.value))}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                >
                  <option value={0} className="bg-slate-900">Cualquiera</option>
                  <option value={3.5} className="bg-slate-900">3.5★ o más</option>
                  <option value={4.0} className="bg-slate-900">4.0★ o más</option>
                  <option value={4.5} className="bg-slate-900">4.5★ o más</option>
                </select>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Reseñas mín.:</span>
                <select
                  value={filterMinReviews}
                  onChange={(e) => setFilterMinReviews(Number(e.target.value))}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                >
                  <option value={0} className="bg-slate-900">0+</option>
                  <option value={10} className="bg-slate-900">10+ reseñas</option>
                  <option value={25} className="bg-slate-900">25+ reseñas</option>
                  <option value={50} className="bg-slate-900">50+ reseñas</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Alerta de Error si ocurre */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h5 className="font-semibold text-rose-100">Error en la consulta</h5>
            <p className="mt-0.5">{errorMessage}</p>
            {errorMessage.toLowerCase().includes('clave') && (
              <button
                type="button"
                onClick={() => setShowApiKeyModal(true)}
                className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Introducir clave de Google Cloud ahora</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra de Progreso de Análisis por Lotes */}
      {isBatchAnalyzing && batchProgress && (
        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Auditando negocios seleccionados (máx. 2 simultáneos con PageSpeed y Gemini)...
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {batchProgress.current} / {batchProgress.total}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (batchProgress.current / batchProgress.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Barra de Acciones y Estadísticas de Resultados */}
      {results.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white"
            >
              {selectedIds.size === filteredResults.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>
                Seleccionar todos ({selectedIds.size} de {filteredResults.length})
              </span>
            </button>

            <span>·</span>
            <span>
              Mostrando <strong className="text-slate-200">{filteredResults.length}</strong> de{' '}
              <strong className="text-slate-200">{results.length}</strong> encontrados
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSaveSelected}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Guardar ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchAnalyze}
                  disabled={isBatchAnalyzing}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analizar ({selectedIds.size})</span>
                </button>
              </>
            )}

            {/* Selector de Vista: Tabla / Tarjetas */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Vista tabla"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Vista tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Resultados: Vista Tabla */}
      {viewMode === 'table' && filteredResults.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-8">
                    <span className="sr-only">Selección</span>
                  </th>
                  <th className="p-3">Negocio / Sector</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3">Web</th>
                  <th className="p-3">Google Maps</th>
                  <th className="p-3">Oportunidad</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredResults.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onOpenLead(lead)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td
                        className="p-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(lead.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </td>

                      <td className="p-3 max-w-xs">
                        <div className="font-semibold text-slate-100 truncate">
                          {lead.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {lead.primaryTypeDisplayName || 'Negocio local'} ·{' '}
                          <span className="text-slate-500 truncate">
                            {lead.formattedAddress}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {lead.nationalPhoneNumber || lead.internationalPhoneNumber ? (
                          <a
                            href={`tel:${
                              lead.nationalPhoneNumber || lead.internationalPhoneNumber
                            }`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-slate-200 hover:text-emerald-400 transition-colors font-mono"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {lead.nationalPhoneNumber || lead.internationalPhoneNumber}
                            </span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">Sin teléfono</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {lead.hasOwnWebsite && lead.websiteUri ? (
                          <a
                            href={lead.websiteUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline max-w-[180px] truncate"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {lead.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                          </a>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              lead.websiteTypeNote
                                ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                                : 'bg-rose-950/60 border-rose-800 text-rose-300'
                            }`}
                          >
                            {lead.websiteTypeNote || 'Sin web propia'}
                          </span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="font-semibold text-slate-200">
                            {lead.rating ? lead.rating.toFixed(1) : '-'}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            ({lead.userRatingCount || 0})
                          </span>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <ScoreBadge
                          score={lead.opportunityScore}
                          isProvisional={lead.isProvisionalScore}
                          breakdown={lead.scoreBreakdown}
                          showBreakdownButton={true}
                        />
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLead(lead);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
                        >
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de Resultados: Vista Tarjetas */}
      {viewMode === 'cards' && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
            return (
              <div
                key={lead.id}
                onClick={() => onOpenLead(lead)}
                className={`p-4 rounded-xl border bg-slate-900/80 hover:border-slate-700 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-950/10'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectItem(lead.id);
                      }}
                      className="mt-0.5 text-slate-500 hover:text-slate-300"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-slate-100 truncate">
                        {lead.displayName}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lead.primaryTypeDisplayName || 'Negocio local'}
                      </p>
                    </div>

                    <ScoreBadge
                      score={lead.opportunityScore}
                      isProvisional={lead.isProvisionalScore}
                      breakdown={lead.scoreBreakdown}
                      size="sm"
                    />
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                    {lead.formattedAddress}
                  </p>

                  <div className="space-y-1.5 text-xs">
                    {/* Teléfono */}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {lead.nationalPhoneNumber || lead.internationalPhoneNumber ? (
                        <a
                          href={`tel:${
                            lead.nationalPhoneNumber || lead.internationalPhoneNumber
                          }`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-300 hover:text-emerald-400 font-mono"
                        >
                          {lead.nationalPhoneNumber || lead.internationalPhoneNumber}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">
                          Sin teléfono
                        </span>
                      )}
                    </div>

                    {/* Web o Badge de Sin Web */}
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {lead.hasOwnWebsite && lead.websiteUri ? (
                        <a
                          href={lead.websiteUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:underline truncate max-w-[200px]"
                        >
                          {lead.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ) : (
                        <span className="text-amber-400 text-[11px] font-medium">
                          {lead.websiteTypeNote || 'Sin web propia'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-400 font-mono">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>{lead.rating ? lead.rating.toFixed(1) : '-'}</span>
                    <span className="text-slate-500 text-[11px]">
                      ({lead.userRatingCount || 0})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={lead.googleMapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Ver en Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenLead(lead)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      Ficha
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón Cargar Más */}
      {nextPageToken && filteredResults.length > 0 && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Cargando más negocios...</span>
              </>
            ) : (
              <span>Cargar más resultados (hasta 60 por búsqueda)</span>
            )}
          </button>
        </div>
      )}

      {/* Estado Vacío */}
      {!isLoading && results.length === 0 && (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-200">
            Explora una zona y un nicho de negocio
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Introduce una localidad (ciudad, barrio o código postal) y una categoría de servicios para descubrir negocios locales y detectar oportunidades inmediatas.
          </p>
        </div>
      )}

      {/* Modal para introducir la clave de Google Cloud sin salir de la búsqueda */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onKeySaved={(updated) => {
          if (onSettingsUpdated) onSettingsUpdated(updated);
          handleSearch(undefined, updated.googleCloudApiKey);
        }}
        title="Clave de Google Cloud requerida"
        subtitle="Introduce tu API Key en este dominio para realizar la búsqueda de negocios locales."
      />
    </div>
  );
};
