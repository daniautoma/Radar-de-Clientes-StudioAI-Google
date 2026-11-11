import { BusinessLead, ScoreItem } from '../types';

/**
 * Calcula la puntuación provisional (0-100) basada únicamente en los datos de Google Places.
 */
export function calculateProvisionalScore(lead: {
  hasOwnWebsite: boolean;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
}): { score: number; breakdown: ScoreItem[] } {
  let score = 0;
  const breakdown: ScoreItem[] = [];

  // 1. Presencia Web
  if (!lead.hasOwnWebsite) {
    if (lead.websiteUri) {
      score += 45;
      breakdown.push({
        label: 'Solo tiene perfil en red social o directorio (sin web propia)',
        points: 45,
        type: 'positive',
      });
    } else {
      score += 50;
      breakdown.push({
        label: 'No tiene página web registrada',
        points: 50,
        type: 'positive',
      });
    }
  } else {
    score += 15;
    breakdown.push({
      label: 'Tiene web propia (requiere auditar rendimiento y conversión)',
      points: 15,
      type: 'neutral',
    });
  }

  // 2. Actividad y Reputación (negocio vivo con clientes y facturación)
  const reviews = lead.userRatingCount || 0;
  if (reviews >= 50) {
    score += 20;
    breakdown.push({
      label: `Negocio muy activo (${reviews} reseñas en Google)`,
      points: 20,
      type: 'positive',
    });
  } else if (reviews >= 15) {
    score += 14;
    breakdown.push({
      label: `Actividad moderada (${reviews} reseñas)`,
      points: 14,
      type: 'positive',
    });
  } else if (reviews > 0) {
    score += 6;
    breakdown.push({
      label: `Pocas reseñas (${reviews} reseñas)`,
      points: 6,
      type: 'neutral',
    });
  } else {
    score -= 10;
    breakdown.push({
      label: 'Sin reseñas públicas (baja actividad aparente)',
      points: -10,
      type: 'negative',
    });
  }

  // Valoración media
  const rating = lead.rating || 0;
  if (rating >= 4.4 && reviews >= 10) {
    score += 15;
    breakdown.push({
      label: `Excelente reputación de clientes (${rating.toFixed(1)}★)`,
      points: 15,
      type: 'positive',
    });
  } else if (rating >= 3.8) {
    score += 8;
    breakdown.push({
      label: `Buena valoración media (${rating.toFixed(1)}★)`,
      points: 8,
      type: 'positive',
    });
  } else if (rating > 0 && rating < 3.5) {
    score -= 5;
    breakdown.push({
      label: `Valoración media baja (${rating.toFixed(1)}★)`,
      points: -5,
      type: 'negative',
    });
  }

  // 3. Facilidad de contacto telefónico
  const hasPhone = Boolean(lead.nationalPhoneNumber || lead.internationalPhoneNumber);
  if (hasPhone) {
    score += 15;
    breakdown.push({
      label: 'Teléfono de contacto directo disponible',
      points: 15,
      type: 'positive',
    });
  } else {
    score -= 15;
    breakdown.push({
      label: 'Sin teléfono publicado en la ficha',
      points: -15,
      type: 'negative',
    });
  }

  // Ajuste de negocio cerrado
  if (lead.businessStatus === 'CLOSED_TEMPORARILY' || lead.businessStatus === 'CLOSED_PERMANENTLY') {
    score = Math.max(0, score - 50);
    breakdown.push({
      label: 'Negocio cerrado temporal o permanentemente',
      points: -50,
      type: 'negative',
    });
  }

  // Normalizar entre 0 y 100
  const normalized = Math.max(5, Math.min(100, Math.round(score)));
  return { score: normalized, breakdown };
}

/**
 * Calcula la puntuación final tras auditoría web de PageSpeed y análisis de Gemini.
 */
export function calculateFinalScore(lead: BusinessLead): {
  score: number;
  breakdown: ScoreItem[];
} {
  // Si no tiene web propia, mantenemos y reforzamos la puntuación de "Sin Web"
  if (!lead.hasOwnWebsite) {
    const prov = calculateProvisionalScore(lead);
    prov.breakdown.push({
      label: 'Oportunidad máxima: venta de pack web + presencia digital completa',
      points: 10,
      type: 'positive',
    });
    return {
      score: Math.min(100, prov.score + 10),
      breakdown: prov.breakdown,
    };
  }

  let score = 25; // Base inicial
  const breakdown: ScoreItem[] = [];

  // Teléfono
  if (lead.nationalPhoneNumber || lead.internationalPhoneNumber) {
    score += 10;
    breakdown.push({
      label: 'Teléfono directo comprobado',
      points: 10,
      type: 'positive',
    });
  }

  // Reseñas y actividad comercial
  const reviews = lead.userRatingCount || 0;
  if (reviews >= 30) {
    score += 15;
    breakdown.push({
      label: `Empresa con clientela consolidada (${reviews} reseñas)`,
      points: 15,
      type: 'positive',
    });
  } else if (reviews >= 10) {
    score += 10;
    breakdown.push({
      label: `Empresa activa (${reviews} reseñas)`,
      points: 10,
      type: 'positive',
    });
  }

  // Auditoría PageSpeed Mobile
  if (lead.pageSpeedAudit) {
    const perf = lead.pageSpeedAudit.performance;
    const seo = lead.pageSpeedAudit.seo;

    if (perf < 45) {
      score += 25;
      breakdown.push({
        label: `Rendimiento móvil crítico en PageSpeed (${perf}/100) — pierde clientes`,
        points: 25,
        type: 'positive',
      });
    } else if (perf < 70) {
      score += 14;
      breakdown.push({
        label: `Rendimiento móvil deficiente (${perf}/100)`,
        points: 14,
        type: 'positive',
      });
    } else if (perf >= 90) {
      score -= 20;
      breakdown.push({
        label: `Web móvil excelente (${perf}/100) — menor urgencia de rediseño`,
        points: -20,
        type: 'negative',
      });
    }

    if (seo < 60) {
      score += 10;
      breakdown.push({
        label: `SEO deficiente (${seo}/100) — no posiciona adecuadamente`,
        points: 10,
        type: 'positive',
      });
    }
  }

  // Análisis Funcional de Gemini
  if (lead.aiAnalysis) {
    const { checklist } = lead.aiAnalysis;

    if (!checklist.hasWhatsAppButton) {
      score += 15;
      breakdown.push({
        label: 'Sin botón de WhatsApp directo (oportunidad de Agente de IA)',
        points: 15,
        type: 'positive',
      });
    }

    if (!checklist.hasOnlineBooking) {
      score += 15;
      breakdown.push({
        label: 'Sin sistema de cita o reserva online (oportunidad de automatización)',
        points: 15,
        type: 'positive',
      });
    }

    if (!checklist.hasHttps) {
      score += 15;
      breakdown.push({
        label: 'Web sin certificado HTTPS seguro (alerta de seguridad al visitante)',
        points: 15,
        type: 'positive',
      });
    }

    if (checklist.hasOutdatedCopyright) {
      score += 10;
      breakdown.push({
        label: `Señales de abandono web (copyright: ${checklist.copyrightYear || 'antiguo'})`,
        points: 10,
        type: 'positive',
      });
    }

    if (!checklist.isMobileResponsive) {
      score += 20;
      breakdown.push({
        label: 'Web no adaptada a teléfonos móviles (responsive deficiente)',
        points: 20,
        type: 'positive',
      });
    }
  }

  const normalized = Math.max(5, Math.min(100, Math.round(score)));
  return { score: normalized, breakdown };
}
