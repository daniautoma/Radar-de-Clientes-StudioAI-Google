import { PageSpeedAudit } from '../types';
import { getSettings } from './db';

/**
 * Ejecuta una auditoría de Google PageSpeed Insights v5 en móvil para una URL dada.
 */
export async function runPageSpeedAudit(
  url: string,
  explicitApiKey?: string
): Promise<PageSpeedAudit> {
  if (!url || !url.trim()) {
    throw new Error('No se puede ejecutar PageSpeed sin una URL.');
  }

  // Asegurar protocolo
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  const settings = await getSettings();
  const apiKey = explicitApiKey || settings.googleCloudApiKey;

  const endpoint = `/api/proxy/pagespeed?url=${encodeURIComponent(targetUrl)}`;

  const response = await fetch(endpoint, {
    headers: {
      ...(apiKey ? { 'X-Goog-Api-Key': apiKey } : {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg =
      data.error?.message ||
      data.error ||
      'Error desconocido al auditar con PageSpeed Insights';
    throw new Error(errorMsg);
  }

  const lh = data.lighthouseResult;
  if (!lh || !lh.categories) {
    throw new Error('La respuesta de Lighthouse no contiene categorías válidas.');
  }

  const performance = Math.round((lh.categories.performance?.score ?? 0) * 100);
  const seo = Math.round((lh.categories.seo?.score ?? 0) * 100);
  const accessibility = Math.round((lh.categories.accessibility?.score ?? 0) * 100);
  const bestPractices = Math.round(
    (lh.categories['best-practices']?.score ?? 0) * 100
  );

  const screenshotBase64 = lh.audits?.['final-screenshot']?.details?.data;
  const loadingExperience = data.loadingExperience?.overall_category;

  return {
    analyzedAt: new Date().toISOString(),
    performance,
    seo,
    accessibility,
    bestPractices,
    screenshotBase64,
    loadingExperience,
  };
}
