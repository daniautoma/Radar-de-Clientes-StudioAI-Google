export type LeadStatus =
  | 'nuevo'
  | 'analizado'
  | 'contactado'
  | 'respondio'
  | 'reunion'
  | 'cliente'
  | 'descartado';

export type PitchTone = 'cercano' | 'formal' | 'persuasivo' | 'directo';

export type ServiceType = 'web_nueva' | 'agente_whatsapp' | 'sistema_citas';

export interface ScoreItem {
  label: string;
  points: number;
  type: 'positive' | 'negative' | 'neutral';
}

export interface PageSpeedAudit {
  analyzedAt: string;
  performance: number; // 0-100
  seo: number; // 0-100
  accessibility: number; // 0-100
  bestPractices: number; // 0-100
  screenshotBase64?: string;
  loadingExperience?: string;
}

export interface AiChecklist {
  hasHttps: boolean;
  isMobileResponsive: boolean;
  hasWhatsAppButton: boolean;
  hasOnlineBooking: boolean;
  hasContactForm: boolean;
  hasOutdatedCopyright: boolean;
  copyrightYear?: string;
}

export interface AiAnalysis {
  activitySummary: string; // 2 frases
  checklist: AiChecklist;
  contactDetailsFound: {
    emails: string[];
    socialLinks: string[];
  };
  detectedIssues: string[]; // 3-5 problemas en lenguaje llano
  recommendedService: ServiceType;
  recommendedServiceReason: string;
  analyzedAt: string;
}

export interface BusinessPitches {
  phoneScript30s: string;
  whatsAppMessage: string;
  emailMessage: string;
  tone: PitchTone;
  generatedAt: string;
}

export interface BusinessLead {
  id: string; // Google Places ID
  displayName: string;
  formattedAddress: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  hasOwnWebsite: boolean; // false si es perfil de redes sociales o directorio
  websiteTypeNote?: string; // e.g. "Perfil de Instagram", "Directorio Páginas Amarillas"
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: string;
  types?: string[];
  googleMapsUri: string;
  businessStatus: string; // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY

  // Puntuación de Oportunidad (0 a 100)
  opportunityScore: number;
  isProvisionalScore: boolean;
  scoreBreakdown: ScoreItem[];

  // Auditorías y análisis
  pageSpeedAudit?: PageSpeedAudit;
  aiAnalysis?: AiAnalysis;
  pitches?: BusinessPitches;

  // CRM y gestión
  status: LeadStatus;
  notes?: string;
  nextActionDate?: string; // YYYY-MM-DD
  savedAt?: string;
  updatedAt?: string;
}

export interface SellerProfile {
  name: string;
  agencyName: string;
  servicesOffered: string[];
  valueProposition: string;
  defaultTone: PitchTone;
}

export interface AppSettings {
  googleCloudApiKey: string;
  sellerProfile: SellerProfile;
  placesApiCounter: {
    monthYear: string; // "2026-10"
    count: number;
    limitAlert: number; // Por defecto 800
  };
  theme: 'dark' | 'light';
}

export interface SearchCacheItem {
  key: string; // normalizado: "sevilla:talleres:0"
  results: BusinessLead[];
  nextPageToken?: string;
  cachedAt: number; // timestamp
}

export interface NicheSummary {
  niche: string;
  totalFound: number;
  noWebsiteCount: number;
  noWebsitePct: number;
  avgRating: number;
  avgReviews: number;
  opportunityScore?: number;
  whyReason?: string;
  recommendedService?: ServiceType;
  recommendedServiceLabel?: string;
  pitchAngle?: string;
  topThree?: boolean;
}
