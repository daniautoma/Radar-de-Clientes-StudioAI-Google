import React, { useState } from 'react';
import {
  Radar,
  MapPin,
  Sparkles,
  AlertTriangle,
  Loader2,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Plus,
  Trash2,
  Zap,
  Star,
  KeyRound,
} from 'lucide-react';
import { AppSettings, NicheSummary } from '../types';
import { searchPlaces } from '../services/placesService';
import { rankNichesWithGemini } from '../services/geminiClient';
import { ApiKeyWarningBanner } from '../components/ApiKeyWarningBanner';
import { ApiKeyModal } from '../components/ApiKeyModal';

const DEFAULT_NICHES = [
  'talleres mecánicos',
  'clínicas dentales',
  'fisioterapeutas',
  'peluquerías',
  'centros de estética',
  'restaurantes',
  'gimnasios',
  'academias',
  'inmobiliarias',
  'veterinarios',
];

interface NichesRadarViewProps {
  settings: AppSettings;
  hasApiKey: boolean;
  onGoToSettings: () => void;
  onSelectNicheForSearch: (location: string, niche: string) => void;
  onSettingsUpdated?: (updated: AppSettings) => void;
}

export const NichesRadarView: React.FC<NichesRadarViewProps> = ({
  settings,
  hasApiKey,
  onGoToSettings,
  onSelectNicheForSearch,
  onSettingsUpdated,
}) => {
  const [location, setLocation] = useState('Dos Hermanas, Sevilla');
  const [selectedNiches, setSelectedNiches] = useState<string[]>(DEFAULT_NICHES);
  const [newNicheInput, setNewNicheInput] = useState('');

  // Modal rápido de API Key
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Estados de confirmación y escaneo
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentNiche: string;
  } | null>(null);

  // Resultados
  const [nicheSummaries, setNicheSummaries] = useState<NicheSummary[]>([]);
  const [topThreeNiches, setTopThreeNiches] = useState<string[]>([]);
  const [summaryAnalysis, setSummaryAnalysis] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddNiche = () => {
    if (!newNicheInput.trim()) return;
    const trimmed = newNicheInput.trim().toLowerCase();
    if (!selectedNiches.includes(trimmed)) {
      setSelectedNiches([...selectedNiches, trimmed]);
    }
    setNewNicheInput('');
  };

  const handleRemoveNiche = (nicheToRemove: string) => {
    setSelectedNiches(selectedNiches.filter((n) => n !== nicheToRemove));
  };

  const handleStartScan = async () => {
    setShowConfirmModal(false);
    setIsScanning(true);
    setErrorMessage(null);
    setNicheSummaries([]);
    setTopThreeNiches([]);
    setSummaryAnalysis('');

    const statsList: NicheSummary[] = [];
    const total = selectedNiches.length;

    try {
      // 1. Escanear cada categoría con Places API
      for (let i = 0; i < total; i++) {
        const niche = selectedNiches[i];
        setScanProgress({
          current: i + 1,
          total,
          currentNiche: niche,
        });

        try {
          const res = await searchPlaces({
            location: location.trim(),
            niche,
          });

          const leads = res.leads;
          const totalFound = leads.length;
          const noWebsiteCount = leads.filter((l) => !l.hasOwnWebsite).length;
          const noWebsitePct =
            totalFound > 0 ? Math.round((noWebsiteCount / totalFound) * 100) : 0;

          const ratedLeads = leads.filter((l) => (l.rating || 0) > 0);
          const avgRating =
            ratedLeads.length > 0
              ? Number(
                  (
                    ratedLeads.reduce((acc, l) => acc + (l.rating || 0), 0) /
                    ratedLeads.length
                  ).toFixed(1)
                )
              : 0;

          const avgReviews =
            totalFound > 0
              ? Math.round(
                  leads.reduce((acc, l) => acc + (l.userRatingCount || 0), 0) /
                    totalFound
                )
              : 0;

          statsList.push({
            niche,
            totalFound,
            noWebsiteCount,
            noWebsitePct,
            avgRating,
            avgReviews,
          });
        } catch (err: any) {
          console.warn(`Error scanning niche ${niche}:`, err);
        }
      }

      // 2. Enviar a Gemini Flash para ordenación y recomendación de servicios
      if (statsList.length > 0) {
        setScanProgress({
          current: total,
          total,
          currentNiche: 'Procesando ranking con Gemini Flash...',
        });

        const rankingRes = await rankNichesWithGemini(location, statsList);
        setTopThreeNiches(rankingRes.topThreeNiches || []);
        setSummaryAnalysis(rankingRes.summaryAnalysis || '');

        // Unir datos de Gemini con las estadísticas recopiladas
        const rankedMap = new Map(
          rankingRes.rankedNiches.map((r) => [r.niche.toLowerCase(), r])
        );

        const merged: NicheSummary[] = statsList.map((st) => {
          const geminiData = rankedMap.get(st.niche.toLowerCase());
          return {
            ...st,
            opportunityScore: geminiData?.opportunityScore || 50,
            whyReason: geminiData?.whyReason,
            recommendedService: geminiData?.recommendedService,
            recommendedServiceLabel: geminiData?.recommendedServiceLabel,
            pitchAngle: geminiData?.pitchAngle,
            topThree: rankingRes.topThreeNiches?.some(
              (top) => top.toLowerCase() === st.niche.toLowerCase()
            ),
          };
        });

        // Ordenar por nota de oportunidad descendente
        merged.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
        setNicheSummaries(merged);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error durante el análisis del radar de nichos');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const estimatedCalls = selectedNiches.length;
  const currentCount = settings.placesApiCounter.count;
  const alertLimit = settings.placesApiCounter.limitAlert;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Banner de API Key si falta */}
      {!hasApiKey && (
        <ApiKeyWarningBanner
          onGoToSettings={onGoToSettings}
          onOpenModal={() => setShowApiKeyModal(true)}
        />
      )}

      {/* Panel de Configuración del Radar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Radar className="w-5 h-5 text-emerald-400" />
              <span>Explorador de Oportunidades por Nicho</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Descubre qué sector de tu ciudad tiene menos páginas web y mayor potencial de facturación antes de prospectar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-8 space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Zona a analizar (Municipio, ciudad o comarca)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Dos Hermanas, Sevilla o Marbella, Málaga"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-4">
            <button
              type="button"
              disabled={isScanning || selectedNiches.length === 0}
              onClick={() => {
                if (!hasApiKey) {
                  setShowApiKeyModal(true);
                  return;
                }
                setShowConfirmModal(true);
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Escaneando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analizar {selectedNiches.length} nichos</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lista de Categorías a analizar (Editable) */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-medium text-slate-400 block">
            Categorías seleccionadas ({selectedNiches.length}):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selectedNiches.map((niche) => (
              <span
                key={niche}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-200 border border-slate-700/80"
              >
                <span>{niche}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveNiche(niche)}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Añadir nuevo nicho */}
          <div className="flex items-center gap-2 max-w-sm pt-1">
            <input
              type="text"
              value={newNicheInput}
              onChange={(e) => setNewNicheInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNiche()}
              placeholder="Añadir otra categoría..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddNiche}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Consumo de API */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100 text-sm">
                  Confirmación de llamadas a Places API
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Estimación de consumo de cuota mensual
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Nichos a consultar:</span>
                <span className="font-mono font-semibold text-white">
                  {estimatedCalls} categorías
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Llamadas estimadas a Places:</span>
                <span className="font-mono font-bold text-amber-400">
                  {estimatedCalls} llamadas
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400">Tu consumo actual este mes:</span>
                <span className="font-mono text-slate-300">
                  {currentCount} / {alertLimit}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Cada nicho ejecuta 1 llamada a Places Text Search para extraer los 20 primeros negocios y calcular métricas agregadas.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartScan}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
              >
                Confirmar y Analizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Progreso del Escaneo */}
      {isScanning && scanProgress && (
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>
                Escaneando nicho {scanProgress.current} de {scanProgress.total}:{' '}
                <strong className="text-white capitalize">{scanProgress.currentNiche}</strong>
              </span>
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {Math.round((scanProgress.current / scanProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (scanProgress.current / scanProgress.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error si ocurre */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Diagnóstico Resumen de Gemini y Top 3 Recomendaciones */}
      {summaryAnalysis && (
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/90 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>Diagnóstico de Mercado de Gemini Flash</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            {summaryAnalysis}
          </p>

          {/* Top 3 Nichos Recomendados */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Top 3 Nichos con Mayor Probabilidad de Venta
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nicheSummaries
                .filter((n) => n.topThree)
                .slice(0, 3)
                .map((n, idx) => (
                  <div
                    key={n.niche}
                    className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          #{idx + 1} TOP NICHO
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {n.opportunityScore}/100
                        </span>
                      </div>
                      <h5 className="font-bold text-sm text-white capitalize">
                        {n.niche}
                      </h5>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        {n.whyReason || 'Alta concentración de negocios sin web y con actividad demostrada.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-emerald-800/40 space-y-2">
                      <div className="text-[11px]">
                        <span className="text-slate-400 block text-[10px]">
                          Servicio estrella sugerido:
                        </span>
                        <span className="font-semibold text-amber-300">
                          {n.recommendedServiceLabel || 'Páginas Web Modernas'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectNicheForSearch(location, n.niche)}
                        className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Ver negocios ({n.totalFound})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabla Comparativa de Todos los Nichos */}
      {nicheSummaries.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Comparativa Completa de Sectores ({location})
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-semibold">
                <tr>
                  <th className="p-3">Sector</th>
                  <th className="p-3 text-center">Encontrados</th>
                  <th className="p-3 text-center">% Sin Web</th>
                  <th className="p-3 text-center">Valoración Media</th>
                  <th className="p-3 text-center">Reseñas Medias</th>
                  <th className="p-3">Oportunidad</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {nicheSummaries.map((item) => (
                  <tr
                    key={item.niche}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-semibold text-slate-100 capitalize">
                      {item.niche}
                    </td>

                    <td className="p-3 text-center font-mono">
                      {item.totalFound}
                    </td>

                    <td className="p-3 text-center font-mono">
                      <span
                        className={`font-semibold ${
                          item.noWebsitePct >= 40
                            ? 'text-emerald-400'
                            : item.noWebsitePct >= 20
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.noWebsitePct}%
                      </span>{' '}
                      <span className="text-[11px] text-slate-500">
                        ({item.noWebsiteCount})
                      </span>
                    </td>

                    <td className="p-3 text-center font-mono">
                      <div className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>{item.avgRating > 0 ? item.avgRating : '-'}</span>
                      </div>
                    </td>

                    <td className="p-3 text-center font-mono">
                      {item.avgReviews}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${
                            (item.opportunityScore || 0) >= 70
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {item.opportunityScore || 50}/100
                        </span>
                        {item.recommendedServiceLabel && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            ({item.recommendedServiceLabel})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectNicheForSearch(location, item.niche)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      >
                        Ver negocios
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para introducir la clave de Google Cloud */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onKeySaved={(updated) => {
          if (onSettingsUpdated) onSettingsUpdated(updated);
          setShowConfirmModal(true);
        }}
        title="Clave de Google Cloud requerida"
        subtitle="Introduce tu API Key en este dominio para consultar y comparar nichos locales."
      />
    </div>
  );
};
