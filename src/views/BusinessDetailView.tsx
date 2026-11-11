import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  Star,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RotateCw,
  Printer,
  Calendar,
  Save,
  MessageSquare,
  Mail,
  Smartphone,
  AlertTriangle,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { BusinessLead, LeadStatus, PitchTone } from '../types';
import { runPageSpeedAudit } from '../services/pageSpeedService';
import {
  analyzeBusinessWithGemini,
  generatePitchesWithGemini,
} from '../services/geminiClient';
import { calculateFinalScore } from '../services/scoringEngine';
import { saveLead } from '../services/db';
import { ScoreBadge } from '../components/ScoreBadge';
import { StatusBadge } from '../components/StatusBadge';
import { PageSpeedMeter } from '../components/PageSpeedMeter';

interface BusinessDetailViewProps {
  lead: BusinessLead;
  onBack: () => void;
  onLeadUpdated: (updated: BusinessLead) => void;
}

export const BusinessDetailView: React.FC<BusinessDetailViewProps> = ({
  lead: initialLead,
  onBack,
  onLeadUpdated,
}) => {
  const [lead, setLead] = useState<BusinessLead>(initialLead);

  // Estados de auditoría y análisis
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState<string>('');
  const [auditError, setAuditError] = useState<string | null>(null);

  // Estados de borradores
  const [selectedTone, setSelectedTone] = useState<PitchTone>(
    lead.pitches?.tone || 'cercano'
  );
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Estados CRM
  const [crmStatus, setCrmStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [nextActionDate, setNextActionDate] = useState(
    lead.nextActionDate || ''
  );
  const [isSavingCrm, setIsSavingCrm] = useState(false);

  const handleAudit = async () => {
    setIsAuditing(true);
    setAuditError(null);

    try {
      let currentLead = { ...lead };

      // 1. PageSpeed (si tiene web propia)
      if (currentLead.hasOwnWebsite && currentLead.websiteUri) {
        setAuditStep('Auditando velocidad y buenas prácticas con Google PageSpeed...');
        try {
          const psiAudit = await runPageSpeedAudit(currentLead.websiteUri);
          currentLead.pageSpeedAudit = psiAudit;
        } catch (err: any) {
          console.warn('PageSpeed warning:', err);
        }
      }

      // 2. Gemini Flash (URL context + diagnóstico comercial)
      setAuditStep('Inspeccionando web con Gemini Flash y detectando puntos de mejora...');
      const aiAnalysis = await analyzeBusinessWithGemini(
        currentLead,
        currentLead.pageSpeedAudit
      );
      currentLead.aiAnalysis = aiAnalysis;

      // 3. Recalcular puntuación consolidada
      const { score, breakdown } = calculateFinalScore(currentLead);
      currentLead.opportunityScore = score;
      currentLead.isProvisionalScore = false;
      currentLead.scoreBreakdown = breakdown;
      currentLead.status = 'analizado';
      setCrmStatus('analizado');

      // 4. Generar primeros borradores con el tono actual
      setAuditStep('Redactando borradores personalizados (Llamada, WhatsApp, Email)...');
      try {
        const pitches = await generatePitchesWithGemini(
          currentLead,
          selectedTone
        );
        currentLead.pitches = pitches;
      } catch (pitchErr) {
        console.warn('Pitch error:', pitchErr);
      }

      // Guardar en base de datos
      await saveLead(currentLead);
      setLead(currentLead);
      onLeadUpdated(currentLead);
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || 'Error durante la auditoría');
    } finally {
      setIsAuditing(false);
      setAuditStep('');
    }
  };

  const handleRegeneratePitches = async (tone: PitchTone) => {
    setSelectedTone(tone);
    setIsGeneratingPitches(true);

    try {
      const pitches = await generatePitchesWithGemini(lead, tone);
      const updated: BusinessLead = {
        ...lead,
        pitches,
      };
      await saveLead(updated);
      setLead(updated);
      onLeadUpdated(updated);
    } catch (err: any) {
      alert('Error al regenerar los mensajes: ' + err.message);
    } finally {
      setIsGeneratingPitches(false);
    }
  };

  const handleSaveCrm = async () => {
    setIsSavingCrm(true);
    const updated: BusinessLead = {
      ...lead,
      status: crmStatus,
      notes,
      nextActionDate,
    };
    await saveLead(updated);
    setLead(updated);
    onLeadUpdated(updated);
    setIsSavingCrm(false);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Botón Volver y Acciones Principales */}
      <div className="flex items-center justify-between no-print">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la búsqueda</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Exportar Ficha (Imprimir / PDF)</span>
          </button>
        </div>
      </div>

      {/* Cabecera del Negocio (Tarjeta Principal) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl print-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-100">
                {lead.displayName}
              </h2>
              <StatusBadge status={lead.status} />
              <ScoreBadge
                score={lead.opportunityScore}
                isProvisional={lead.isProvisionalScore}
                breakdown={lead.scoreBreakdown}
                size="md"
                showBreakdownButton={true}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>{lead.primaryTypeDisplayName || 'Negocio Local'}</span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {lead.rating ? lead.rating.toFixed(1) : '-'} ({lead.userRatingCount || 0} reseñas)
              </span>
            </p>
          </div>

          {/* Botón de Auditoría Web */}
          <div className="no-print shrink-0">
            <button
              type="button"
              onClick={handleAudit}
              disabled={isAuditing}
              className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
            >
              {isAuditing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>{auditStep || 'Analizando...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {lead.aiAnalysis ? 'Re-analizar Web' : 'Analizar Web con IA'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Datos de Contacto y Acciones Directas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
          {/* Teléfono */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 block">Teléfono</span>
                {lead.nationalPhoneNumber || lead.internationalPhoneNumber ? (
                  <span className="font-mono text-slate-200 font-medium">
                    {lead.nationalPhoneNumber || lead.internationalPhoneNumber}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">No disponible</span>
                )}
              </div>
            </div>
            {(lead.nationalPhoneNumber || lead.internationalPhoneNumber) && (
              <a
                href={`tel:${lead.nationalPhoneNumber || lead.internationalPhoneNumber}`}
                className="no-print px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-medium text-[11px]"
              >
                Llamar
              </a>
            )}
          </div>

          {/* Web */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 block">Sitio Web</span>
                {lead.hasOwnWebsite && lead.websiteUri ? (
                  <span className="text-slate-200 truncate font-mono">
                    {lead.websiteUri.replace(/^https?:\/\/(www\.)?/, '')}
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">
                    {lead.websiteTypeNote || 'Sin web propia'}
                  </span>
                )}
              </div>
            </div>
            {lead.websiteUri && (
              <a
                href={lead.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="no-print p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Abrir web"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Dirección y Google Maps */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-500 block">Dirección</span>
                <span className="text-slate-300 truncate block">
                  {lead.formattedAddress}
                </span>
              </div>
            </div>
            <a
              href={lead.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="no-print p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              title="Abrir en Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Mensaje de Error de Auditoría */}
        {auditError && (
          <div className="mt-4 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{auditError}</span>
          </div>
        )}
      </div>

      {/* Si no tiene web propia */}
      {!lead.hasOwnWebsite && (
        <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-100 text-sm">
              Negocio sin página web propia (Oportunidad Alta)
            </h4>
            <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
              Este negocio está perdiendo clientes que buscan sus servicios en Google y dependen de directorios o redes sociales. No es necesario realizar prueba de velocidad PageSpeed. La propuesta ideal para este cliente es un{' '}
              <strong>desarrollo web profesional rápido</strong> combinado con un{' '}
              <strong>asistente de citas o WhatsApp</strong> para amortizar la inversión en menos de 30 días.
            </p>
          </div>
        </div>
      )}

      {/* Resultados de PageSpeed Insights (si se han analizado) */}
      {lead.hasOwnWebsite && (
        <PageSpeedMeter
          audit={lead.pageSpeedAudit}
          isLoading={isAuditing && Boolean(!lead.pageSpeedAudit)}
        />
      )}

      {/* Diagnóstico de Gemini (Resumen, Checklist, Problemas y Servicio Sugerido) */}
      {lead.aiAnalysis && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-6 shadow-xl print-card">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Diagnóstico Estratégico de Gemini Flash
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Analizado: {new Date(lead.aiAnalysis.analyzedAt).toLocaleDateString('es-ES')}
            </span>
          </div>

          {/* Resumen de actividad en 2 frases */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              ¿A qué se dedica el negocio?
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
              {lead.aiAnalysis.activitySummary}
            </p>
          </div>

          {/* Checklist técnica de funcionalidades clave */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Comprobación de conversión y presencia
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {[
                {
                  label: 'Certificado HTTPS seguro',
                  ok: lead.aiAnalysis.checklist.hasHttps,
                },
                {
                  label: 'Adaptada a móviles (Responsive)',
                  ok: lead.aiAnalysis.checklist.isMobileResponsive,
                },
                {
                  label: 'Botón directo de WhatsApp',
                  ok: lead.aiAnalysis.checklist.hasWhatsAppButton,
                },
                {
                  label: 'Citas o reservas online',
                  ok: lead.aiAnalysis.checklist.hasOnlineBooking,
                },
                {
                  label: 'Formulario de contacto',
                  ok: lead.aiAnalysis.checklist.hasContactForm,
                },
                {
                  label: `Copyright actualizado (${
                    lead.aiAnalysis.checklist.copyrightYear || 'N/D'
                  })`,
                  ok: !lead.aiAnalysis.checklist.hasOutdatedCopyright,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    item.ok
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                  }`}
                >
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span className="text-[11px] leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Problemas detectados en lenguaje llano */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Problemas detectados (para argumentar en la venta)
            </h4>
            <div className="space-y-2">
              {lead.aiAnalysis.detectedIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                    {idx + 1}
                  </span>
                  <p className="leading-relaxed">{issue}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Qué servicio ofrecerle y por qué */}
          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/30 text-indigo-200">
            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold block mb-1">
              Servicio digital prioritario recomendado
            </span>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                {lead.aiAnalysis.recommendedService === 'web_nueva'
                  ? 'Rediseño Web Moderno y Rápido'
                  : lead.aiAnalysis.recommendedService === 'agente_whatsapp'
                  ? 'Agente de Inteligencia Artificial para WhatsApp'
                  : 'Sistema de Citas y Reservas Automatizadas'}
              </span>
            </div>
            <p className="text-xs text-indigo-300 leading-relaxed">
              {lead.aiAnalysis.recommendedServiceReason}
            </p>
          </div>
        </div>
      )}

      {/* Primer Contacto: 3 Borradores Personalizados */}
      {lead.pitches && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5 shadow-xl print-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Borradores de Primer Contacto</span>
              </h3>
              <p className="text-xs text-slate-400">
                Generados con tus datos de vendedor y adaptados a las debilidades del negocio.
              </p>
            </div>

            {/* Selector de Tono */}
            <div className="no-print flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['cercano', 'formal', 'persuasivo', 'directo'] as PitchTone[]).map(
                (tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleRegeneratePitches(tone)}
                    disabled={isGeneratingPitches}
                    className={`px-2.5 py-1 rounded capitalize transition-colors ${
                      selectedTone === tone
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tone}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Aviso de ética legal obligatorio */}
          <div className="p-3 rounded-lg border border-slate-700/60 bg-slate-950/60 text-slate-400 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Aviso legal:</strong> Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento.
            </span>
          </div>

          {/* 1. Guion de llamada 30 segundos */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Guion de llamada telefónica (30 segundos)
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(lead.pitches!.phoneScript30s, 'phone')
                }
                className="no-print text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {copiedField === 'phone' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              {lead.pitches.phoneScript30s}
            </p>
          </div>

          {/* 2. Mensaje de WhatsApp */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Mensaje de WhatsApp
              </span>
              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(lead.pitches!.whatsAppMessage, 'whatsapp')
                  }
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {copiedField === 'whatsapp' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                {lead.nationalPhoneNumber && (
                  <a
                    href={`https://wa.me/${lead.nationalPhoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                      lead.pitches.whatsAppMessage
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Abrir WhatsApp</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              {lead.pitches.whatsAppMessage}
            </p>
          </div>

          {/* 3. Correo electrónico */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Correo de prospección
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(lead.pitches!.emailMessage, 'email')
                }
                className="no-print text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              {lead.pitches.emailMessage}
            </p>
          </div>
        </div>
      )}

      {/* Gestión Comercial / CRM / Notas del Vendedor */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl no-print">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Gestión Comercial y Próxima Acción</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              Estado en Pipeline
            </label>
            <select
              value={crmStatus}
              onChange={(e) => setCrmStatus(e.target.value as LeadStatus)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="nuevo">Nuevo</option>
              <option value="analizado">Analizado</option>
              <option value="contactado">Contactado</option>
              <option value="respondio">Respondió</option>
              <option value="reunion">Reunión agendada</option>
              <option value="cliente">Cliente cerrado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              Fecha de Próxima Acción / Seguimiento
            </label>
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-medium text-xs">
            Notas privadas (objeciones, persona de contacto, presupuesto)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Escribe aquí apuntes sobre la llamada o la visita presencial..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveCrm}
            disabled={isSavingCrm}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Seguimiento</span>
          </button>
        </div>
      </div>
    </div>
  );
};
