import { BusinessLead } from '../types';
import {
  getSearchCache,
  getSettings,
  incrementPlacesCounter,
  setSearchCache,
} from './db';
import { calculateProvisionalScore } from './scoringEngine';

const THIRD_PARTY_DOMAINS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  'instagr.am',
  'linktr.ee',
  'bio.link',
  'beacons.ai',
  'campsite.bio',
  'taplink.cc',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'paginasamarillas.es',
  'qdq.com',
  'milanuncios.com',
  'doctoralia.es',
  'tripadvisor.es',
  'tripadvisor.com',
  'thefork.es',
  'eltenedor.es',
  'habitissimo.es',
  'cronoshare.com',
  'bodas.net',
  'topdoctors.es',
  'guiacampsa.com',
  'europages.es',
  'infocif.es',
  'einforma.com',
  'axesor.es',
  'guiatelefonica.es',
  'cylex.es',
  'vulcano.biz',
  'just-eat.es',
  'glovoapp.com',
  'ubereats.com',
];

/**
 * Analiza una URL para determinar si es un sitio web propio o un perfil de terceros/directorio.
 */
export function checkWebsiteOwnership(url?: string): {
  hasOwnWebsite: boolean;
  typeNote?: string;
} {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { hasOwnWebsite: false, typeNote: 'Sin web' };
  }

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    for (const domain of THIRD_PARTY_DOMAINS) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        if (domain.includes('facebook') || domain.includes('fb.')) {
          return { hasOwnWebsite: false, typeNote: 'Perfil de Facebook' };
        }
        if (domain.includes('instagram')) {
          return { hasOwnWebsite: false, typeNote: 'Perfil de Instagram' };
        }
        if (
          domain.includes('linktr') ||
          domain.includes('bio.link') ||
          domain.includes('beacons')
        ) {
          return { hasOwnWebsite: false, typeNote: 'Enlace Linktree / Bio' };
        }
        return { hasOwnWebsite: false, typeNote: `Directorio (${domain})` };
      }
    }

    return { hasOwnWebsite: true };
  } catch {
    return { hasOwnWebsite: false, typeNote: 'Enlace inválido' };
  }
}

export interface SearchPlacesParams {
  location: string; // e.g. "Dos Hermanas, Sevilla"
  niche: string; // e.g. "talleres mecánicos"
  pageToken?: string;
  skipCache?: boolean;
  apiKey?: string;
}

export interface SearchPlacesResult {
  leads: BusinessLead[];
  nextPageToken?: string;
  fromCache: boolean;
}

/**
 * Busca negocios usando Places API (New) text search con languageCode="es" y regionCode="ES"
 */
export async function searchPlaces({
  location,
  niche,
  pageToken,
  skipCache = false,
  apiKey: explicitApiKey,
}: SearchPlacesParams): Promise<SearchPlacesResult> {
  const textQuery = `${niche.trim()} en ${location.trim()}`;
  const cacheKey = `${location.trim()}:${niche.trim()}:${pageToken || 'initial'}`;

  // 1. Comprobar caché local si no se fuerza salto
  if (!skipCache && !pageToken) {
    const cached = await getSearchCache(cacheKey);
    if (cached) {
      return {
        leads: cached.results,
        nextPageToken: cached.nextPageToken,
        fromCache: true,
      };
    }
  }

  // 2. Obtener clave de Google Cloud desde parámetro explícito, ajustes o entorno
  const settings = await getSettings();
  const apiKey = explicitApiKey || settings.googleCloudApiKey;

  const payload: Record<string, any> = {
    textQuery,
    languageCode: 'es',
    regionCode: 'ES',
    pageSize: 20,
  };

  if (pageToken) {
    payload.pageToken = pageToken;
  }

  const response = await fetch('/api/proxy/places-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Goog-Api-Key': apiKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg =
      data.error?.message ||
      data.error ||
      'Error desconocido al consultar Google Places API';
    throw new Error(errMsg);
  }

  // Incrementar contador de llamadas en los ajustes del usuario
  await incrementPlacesCounter(1);

  const rawPlaces = data.places || [];
  const leads: BusinessLead[] = rawPlaces.map((p: any) => {
    const { hasOwnWebsite, typeNote } = checkWebsiteOwnership(p.websiteUri);

    const leadBase = {
      id: p.id,
      displayName: p.displayName?.text || 'Negocio sin nombre',
      formattedAddress: p.formattedAddress || 'Dirección no indicada',
      location: p.location
        ? {
            latitude: p.location.latitude,
            longitude: p.location.longitude,
          }
        : undefined,
      nationalPhoneNumber: p.nationalPhoneNumber,
      internationalPhoneNumber: p.internationalPhoneNumber,
      websiteUri: p.websiteUri,
      hasOwnWebsite,
      websiteTypeNote: typeNote,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      primaryTypeDisplayName: p.primaryTypeDisplayName?.text,
      types: p.types,
      googleMapsUri:
        p.googleMapsUri ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          p.displayName?.text || ''
        )}&query_place_id=${p.id}`,
      businessStatus: p.businessStatus || 'OPERATIONAL',
      status: 'nuevo' as const,
    };

    const { score, breakdown } = calculateProvisionalScore(leadBase);

    return {
      ...leadBase,
      opportunityScore: score,
      isProvisionalScore: true,
      scoreBreakdown: breakdown,
    };
  });

  // Guardar en caché si no es paginación profunda
  if (!pageToken) {
    await setSearchCache(cacheKey, leads, data.nextPageToken);
  }

  return {
    leads,
    nextPageToken: data.nextPageToken,
    fromCache: false,
  };
}
