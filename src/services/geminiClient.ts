import {
  AiAnalysis,
  BusinessLead,
  BusinessPitches,
  NicheSummary,
  PageSpeedAudit,
  PitchTone,
} from '../types';
import { getSettings } from './db';

/**
 * Llama al endpoint de backend para analizar el negocio y su sitio web con Gemini Flash y urlContext.
 */
export async function analyzeBusinessWithGemini(
  lead: BusinessLead,
  pageSpeedAudit?: PageSpeedAudit
): Promise<AiAnalysis> {
  const pageSpeedSummary = pageSpeedAudit
    ? {
        performanceScore: pageSpeedAudit.performance,
        seoScore: pageSpeedAudit.seo,
        accessibilityScore: pageSpeedAudit.accessibility,
        bestPracticesScore: pageSpeedAudit.bestPractices,
      }
    : null;

  const response = await fetch('/api/gemini/analyze-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: lead.displayName,
      websiteUrl: lead.hasOwnWebsite ? lead.websiteUri : undefined,
      category: lead.primaryTypeDisplayName,
      formattedAddress: lead.formattedAddress,
      phoneNumber: lead.nationalPhoneNumber || lead.internationalPhoneNumber,
      pageSpeedSummary,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error al procesar el análisis con Gemini');
  }

  const analysis: AiAnalysis = {
    ...data.analysis,
    analyzedAt: new Date().toISOString(),
  };

  return analysis;
}

/**
 * Genera guion de llamada, WhatsApp y correo comercial adaptados al negocio y al perfil del vendedor.
 */
export async function generatePitchesWithGemini(
  lead: BusinessLead,
  tone: PitchTone = 'cercano'
): Promise<BusinessPitches> {
  const settings = await getSettings();

  const response = await fetch('/api/gemini/generate-pitches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: lead.displayName,
      category: lead.primaryTypeDisplayName,
      activitySummary:
        lead.aiAnalysis?.activitySummary ||
        `${lead.displayName} en ${lead.formattedAddress}`,
      detectedIssues: lead.aiAnalysis?.detectedIssues || [
        !lead.hasOwnWebsite
          ? 'No dispone de página web propia para captar clientes en Google'
          : 'Página web desactualizada y sin atención automática por WhatsApp',
      ],
      recommendedService:
        lead.aiAnalysis?.recommendedService ||
        (!lead.hasOwnWebsite ? 'web_nueva' : 'agente_whatsapp'),
      recommendedServiceReason:
        lead.aiAnalysis?.recommendedServiceReason ||
        'Permite captar más clientes en piloto automático',
      sellerProfile: settings.sellerProfile,
      tone,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error al generar los borradores con Gemini');
  }

  const pitches: BusinessPitches = {
    phoneScript30s: data.pitches.phoneScript30s,
    whatsAppMessage: data.pitches.whatsAppMessage,
    emailMessage: data.pitches.emailMessage,
    tone,
    generatedAt: new Date().toISOString(),
  };

  return pitches;
}

/**
 * Ordena y analiza estratégicamente un conjunto de nichos en una localidad con Gemini.
 */
export async function rankNichesWithGemini(
  location: string,
  nicheStats: NicheSummary[]
): Promise<{
  topThreeNiches: string[];
  summaryAnalysis: string;
  rankedNiches: Array<{
    niche: string;
    opportunityScore: number;
    whyReason: string;
    recommendedService: 'web_nueva' | 'agente_whatsapp' | 'sistema_citas';
    recommendedServiceLabel: string;
    pitchAngle: string;
  }>;
}> {
  const response = await fetch('/api/gemini/rank-niches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      nicheStats: nicheStats.map((n) => ({
        niche: n.niche,
        totalFound: n.totalFound,
        noWebsiteCount: n.noWebsiteCount,
        noWebsitePct: n.noWebsitePct,
        avgRating: n.avgRating,
        avgReviews: n.avgReviews,
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error al categorizar nichos con Gemini');
  }

  return data.ranking;
}
