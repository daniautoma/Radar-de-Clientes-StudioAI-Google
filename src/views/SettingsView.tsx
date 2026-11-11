import React, { useState } from 'react';
import {
  KeyRound,
  User,
  Activity,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sun,
  Moon,
  Trash2,
  Database,
  ExternalLink,
} from 'lucide-react';
import { AppSettings, PitchTone } from '../types';
import { clearSearchCache, saveSettings } from '../services/db';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsSaved: (updated: AppSettings) => void;
  onToggleTheme: () => void;
  onLeadsUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings: initialSettings,
  onSettingsSaved,
  onToggleTheme,
  onLeadsUpdated,
}) => {
  const [apiKey, setApiKey] = useState(initialSettings.googleCloudApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Perfil del vendedor
  const [sellerName, setSellerName] = useState(
    initialSettings.sellerProfile.name
  );
  const [agencyName, setAgencyName] = useState(
    initialSettings.sellerProfile.agencyName
  );
  const [servicesOffered, setServicesOffered] = useState(
    initialSettings.sellerProfile.servicesOffered.join('\n')
  );
  const [valueProposition, setValueProposition] = useState(
    initialSettings.sellerProfile.valueProposition
  );
  const [defaultTone, setDefaultTone] = useState<PitchTone>(
    initialSettings.sellerProfile.defaultTone
  );

  // Cuota Places
  const [limitAlert, setLimitAlert] = useState<number>(
    initialSettings.placesApiCounter.limitAlert || 800
  );
  const [currentCount, setCurrentCount] = useState<number>(
    initialSettings.placesApiCounter.count
  );

  const [savedSuccessMessage, setSavedSuccessMessage] = useState(false);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();

    const updated = await saveSettings({
      googleCloudApiKey: apiKey.trim(),
      sellerProfile: {
        name: sellerName.trim(),
        agencyName: agencyName.trim(),
        servicesOffered: servicesOffered
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        valueProposition: valueProposition.trim(),
        defaultTone,
      },
      placesApiCounter: {
        monthYear: initialSettings.placesApiCounter.monthYear,
        count: currentCount,
        limitAlert,
      },
    });

    onSettingsSaved(updated);
    setSavedSuccessMessage(true);
    setTimeout(() => setSavedSuccessMessage(false), 3000);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestStatus({
        tested: true,
        success: false,
        message: 'Por favor, escribe tu API Key antes de probarla.',
      });
      return;
    }

    setIsTestingKey(true);
    setTestStatus(null);

    try {
      // Prueba rápida realizando una consulta de Places
      const testRes = await fetch('/api/proxy/places-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey.trim(),
        },
        body: JSON.stringify({
          textQuery: 'talleres en Madrid',
          languageCode: 'es',
          regionCode: 'ES',
          pageSize: 1,
        }),
      });

      const data = await testRes.json();
      if (testRes.ok) {
        setTestStatus({
          tested: true,
          success: true,
          message: '¡Conexión exitosa! Tu API Key tiene acceso a Places API (New).',
        });
      } else {
        setTestStatus({
          tested: true,
          success: false,
          message:
            data.error?.message ||
            'Error al validar la clave. Comprueba que "Places API (New)" esté habilitada en tu Google Cloud Console.',
        });
      }
    } catch (err: any) {
      setTestStatus({
        tested: true,
        success: false,
        message: 'Error de red al comprobar la clave: ' + err.message,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleClearCache = async () => {
    if (
      window.confirm(
        '¿Deseas vaciar la caché local de búsquedas de Google Places? Tus leads guardados NO se borrarán.'
      )
    ) {
      await clearSearchCache();
      alert('Caché de búsquedas vaciada correctamente.');
    }
  };

  const handleResetCounter = async () => {
    if (window.confirm('¿Deseas poner a 0 el contador de llamadas de este mes?')) {
      setCurrentCount(0);
      await saveSettings({
        placesApiCounter: {
          monthYear: initialSettings.placesApiCounter.monthYear,
          count: 0,
          limitAlert,
        },
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {savedSuccessMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configuración guardada correctamente en tu navegador.</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-8">
        {/* 1. Clave de Google Cloud */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">
                  Clave de Google Cloud API
                </h3>
                <p className="text-xs text-slate-400">
                  Utilizada para Places API (New) y Google PageSpeed Insights v5.
                </p>
              </div>
            </div>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              Tu API Key de Google Cloud
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestKey}
                disabled={isTestingKey}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isTestingKey ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Probar Clave</span>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Esta clave se almacena exclusivamente en tu navegador (IndexedDB) y nunca se comparte ni se sube al código fuente. Asegúrate de tener habilitadas las APIs <strong>Places API (New)</strong> y <strong>PageSpeed Insights API</strong> en tu proyecto.
            </p>
          </div>

          {testStatus && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                testStatus.success
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* 2. Perfil del Vendedor */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl">
          <div className="pb-3 border-b border-slate-800 flex items-center gap-2.5">
            <User className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Perfil del Vendedor / Agencia
              </h3>
              <p className="text-xs text-slate-400">
                Gemini utiliza esta información para personalizar los borradores de llamadas, WhatsApp y correos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                Tu nombre
              </label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Ej. David García"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                Nombre de tu agencia o proyecto
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ej. Impacto Digital"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-slate-300 block mb-1 font-medium">
              Servicios que ofreces (uno por línea)
            </label>
            <textarea
              value={servicesOffered}
              onChange={(e) => setServicesOffered(e.target.value)}
              rows={3}
              placeholder="Páginas web modernas&#10;Agentes de WhatsApp con IA&#10;Sistemas de citas online"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="text-xs">
            <label className="text-slate-300 block mb-1 font-medium">
              Tu propuesta de valor principal
            </label>
            <input
              type="text"
              value={valueProposition}
              onChange={(e) => setValueProposition(e.target.value)}
              placeholder="Ej. Ayudo a negocios locales a captar más clientes y automatizar la atención sin perder ventas"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="text-xs">
            <label className="text-slate-300 block mb-1 font-medium">
              Tono preferido por defecto para los mensajes
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['cercano', 'formal', 'persuasivo', 'directo'] as PitchTone[]).map(
                (tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setDefaultTone(tone)}
                    className={`py-2 px-3 rounded-lg border text-xs capitalize transition-colors ${
                      defaultTone === tone
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tone}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* 3. Control de Cuota de Places API */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">
                  Control de Cuota Mensual (Places API)
                </h3>
                <p className="text-xs text-slate-400">
                  Google Cloud incluye un cupo de crédito gratuito mensual. Monitoriza tu consumo para evitar cargos imprevistos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetCounter}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
            >
              Reiniciar a 0
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                Llamadas realizadas este mes ({initialSettings.placesApiCounter.monthYear})
              </label>
              <input
                type="number"
                value={currentCount}
                onChange={(e) => setCurrentCount(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                Límite de alerta configurable (por defecto 800 de 1.000)
              </label>
              <input
                type="number"
                value={limitAlert}
                onChange={(e) => setLimitAlert(Number(e.target.value))}
                min={10}
                max={5000}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Apariencia y Mantenimiento de Datos */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl">
          <div className="pb-3 border-b border-slate-800 flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Apariencia y Almacenamiento Local
              </h3>
              <p className="text-xs text-slate-400">
                Preferencias de visualización y caché en este navegador.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-medium text-slate-200 block">Tema visual</span>
              <span className="text-slate-400">
                {initialSettings.theme === 'dark' ? 'Tema Oscuro (Por defecto)' : 'Tema Claro'}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors"
            >
              {initialSettings.theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Cambiar a Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-300" />
                  <span>Cambiar a Modo Oscuro</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div>
              <span className="font-medium text-slate-200 block">
                Caché de Búsquedas de Google Places
              </span>
              <span className="text-slate-400">
                Guarda los resultados durante 48 horas para no repetir llamadas a la API.
              </span>
            </div>

            <button
              type="button"
              onClick={handleClearCache}
              className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Vaciar Caché</span>
            </button>
          </div>
        </div>

        {/* Botón Guardar Cambios */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Todos los Ajustes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
