import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { saveSettings } from '../services/db';
import { AppSettings } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (updatedSettings: AppSettings) => void;
  title?: string;
  subtitle?: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
  title = 'Clave de Google Cloud requerida',
  subtitle = 'Al publicar la app en un nuevo dominio, debes introducir tu API Key en este navegador para consultar Places y PageSpeed.',
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKey.trim()) {
      setStatus({ success: false, message: 'Por favor, introduce tu clave de Google Cloud.' });
      return;
    }

    setIsTesting(true);
    setStatus(null);

    try {
      // Probar si la clave funciona con Places API
      const res = await fetch('/api/proxy/places-search', {
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

      const data = await res.json();
      if (!res.ok) {
        setStatus({
          success: false,
          message:
            data.error?.message ||
            'Error al validar la clave. Asegúrate de tener habilitadas "Places API (New)" y "PageSpeed Insights API".',
        });
        setIsTesting(false);
        return;
      }

      // Guardar en la base de datos local de este dominio
      const updated = await saveSettings({ googleCloudApiKey: apiKey.trim() });
      setStatus({ success: true, message: '¡Clave validada y guardada correctamente!' });

      setTimeout(() => {
        onKeySaved(updated);
        onClose();
      }, 700);
    } catch (err: any) {
      // Si falla la prueba de red, aún así permitir guardarla
      const updated = await saveSettings({ googleCloudApiKey: apiKey.trim() });
      onKeySaved(updated);
      onClose();
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveWithoutTest = async () => {
    if (!apiKey.trim()) return;
    const updated = await saveSettings({ googleCloudApiKey: apiKey.trim() });
    onKeySaved(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 space-y-2">
          <p className="text-[11px] leading-relaxed text-slate-400">
            <strong>¿Por qué pide la clave aquí?</strong> La versión publicada tiene una dirección web (URL) distinta a la vista previa de AI Studio. Por seguridad, el navegador no comparte el almacenamiento entre dominios distintos.
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-400">¿No tienes tu clave a mano?</span>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Copiar de Google Cloud Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Pega tu clave de Google Cloud API
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                status.success
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {status.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveWithoutTest}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Guardar sin probar
            </button>
            <button
              type="submit"
              disabled={isTesting || !apiKey.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validando clave...</span>
                </>
              ) : (
                <span>Guardar y usar clave</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
