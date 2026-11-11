import { AppSettings, BusinessLead, SearchCacheItem } from '../types';

const DB_NAME = 'radar_clientes_db';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  googleCloudApiKey: '',
  sellerProfile: {
    name: 'David García',
    agencyName: 'Impacto Digital',
    servicesOffered: [
      'Páginas web modernas y optimizadas para móvil',
      'Agentes de IA para WhatsApp 24/7',
      'Sistemas automatizados de citas y reservas',
    ],
    valueProposition:
      'Ayudo a negocios locales a captar más clientes y automatizar la atención sin perder ventas por no contestar a tiempo.',
    defaultTone: 'cercano',
  },
  placesApiCounter: {
    monthYear: new Date().toISOString().slice(0, 7), // "YYYY-MM"
    count: 0,
    limitAlert: 800,
  },
  theme: 'dark',
};

// In-memory cache to guarantee zero delay and prevent race conditions
let inMemorySettings: AppSettings = { ...DEFAULT_SETTINGS };

// Load any localStorage backup synchronously on module evaluation
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('radar_settings_backup');
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemorySettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        sellerProfile: {
          ...DEFAULT_SETTINGS.sellerProfile,
          ...(parsed.sellerProfile || {}),
        },
        placesApiCounter: {
          ...DEFAULT_SETTINGS.placesApiCounter,
          ...(parsed.placesApiCounter || {}),
        },
      };
    }
  } catch {}
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const timer = setTimeout(() => {
      reject(new Error('IndexedDB open timeout'));
    }, 2000);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('leads')) {
          const leadStore = db.createObjectStore('leads', { keyPath: 'id' });
          leadStore.createIndex('status', 'status', { unique: false });
          leadStore.createIndex('savedAt', 'savedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('search_cache')) {
          db.createObjectStore('search_cache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(request.result);
      };

      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('app_config');

      req.onsuccess = () => {
        const stored = req.result?.value;
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (stored) {
          inMemorySettings = {
            ...DEFAULT_SETTINGS,
            ...stored,
            sellerProfile: {
              ...DEFAULT_SETTINGS.sellerProfile,
              ...(stored.sellerProfile || {}),
            },
            placesApiCounter: {
              ...DEFAULT_SETTINGS.placesApiCounter,
              ...(stored.placesApiCounter || {}),
            },
          };
          if (inMemorySettings.placesApiCounter.monthYear !== currentMonth) {
            inMemorySettings.placesApiCounter = {
              monthYear: currentMonth,
              count: 0,
              limitAlert: inMemorySettings.placesApiCounter.limitAlert || 800,
            };
            saveSettings(inMemorySettings);
          }
        }
        resolve(inMemorySettings);
      };
      req.onerror = () => resolve(inMemorySettings);
    });
  } catch (err) {
    console.warn('Using in-memory/localStorage settings fallback:', err);
    return inMemorySettings;
  }
}

export async function saveSettings(
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  const updated: AppSettings = {
    ...inMemorySettings,
    ...partial,
    sellerProfile: {
      ...inMemorySettings.sellerProfile,
      ...(partial.sellerProfile || {}),
    },
    placesApiCounter: {
      ...inMemorySettings.placesApiCounter,
      ...(partial.placesApiCounter || {}),
    },
  };

  inMemorySettings = updated;

  // Backup to localStorage
  try {
    localStorage.setItem('radar_settings_backup', JSON.stringify(updated));
  } catch {}

  // Save to IndexedDB
  try {
    const db = await openDb();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key: 'app_config', value: updated });
  } catch (err) {
    console.warn('Error saving settings to IndexedDB:', err);
  }

  return updated;
}

export async function incrementPlacesCounter(amount = 1): Promise<number> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  let newCount = inMemorySettings.placesApiCounter.count + amount;
  if (inMemorySettings.placesApiCounter.monthYear !== currentMonth) {
    newCount = amount;
  }

  await saveSettings({
    placesApiCounter: {
      monthYear: currentMonth,
      count: newCount,
      limitAlert: inMemorySettings.placesApiCounter.limitAlert,
    },
  });

  return newCount;
}

// Helpers for localStorage leads backup
function getBackupLeads(): BusinessLead[] {
  try {
    const raw = localStorage.getItem('radar_leads_backup');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function setBackupLeads(leads: BusinessLead[]) {
  try {
    // Keep max 50 leads in localStorage backup to avoid quota issues
    const trimmed = leads.slice(0, 50);
    localStorage.setItem('radar_leads_backup', JSON.stringify(trimmed));
  } catch {}
}

export async function saveLead(lead: BusinessLead): Promise<void> {
  const leadToSave: BusinessLead = {
    ...lead,
    savedAt: lead.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Update backup
  const backup = getBackupLeads();
  const idx = backup.findIndex((l) => l.id === lead.id);
  if (idx >= 0) {
    backup[idx] = leadToSave;
  } else {
    backup.unshift(leadToSave);
  }
  setBackupLeads(backup);

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      const req = store.put(leadToSave);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, persisted to localStorage:', err);
  }
}

export async function saveLeads(leads: BusinessLead[]): Promise<void> {
  const now = new Date().toISOString();
  const leadsToSave = leads.map((lead) => ({
    ...lead,
    savedAt: lead.savedAt || now,
    updatedAt: now,
  }));

  // Update backup
  const backup = getBackupLeads();
  const existingMap = new Map(backup.map((l) => [l.id, l]));
  for (const l of leadsToSave) {
    existingMap.set(l.id, l);
  }
  setBackupLeads(Array.from(existingMap.values()));

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');

      for (const lead of leadsToSave) {
        store.put(lead);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, persisted to localStorage:', err);
  }
}

export async function getLead(id: string): Promise<BusinessLead | undefined> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readonly');
      const store = tx.objectStore('leads');
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const backup = getBackupLeads();
    return backup.find((l) => l.id === id);
  }
}

export async function getAllLeads(): Promise<BusinessLead[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readonly');
      const store = tx.objectStore('leads');
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as BusinessLead[]) || [];
        list.sort((a, b) => {
          const da = a.updatedAt || a.savedAt || '';
          const db = b.updatedAt || b.savedAt || '';
          return db.localeCompare(da);
        });
        resolve(list);
      };
      req.onerror = () => resolve(getBackupLeads());
    });
  } catch {
    return getBackupLeads();
  }
}

export async function deleteLead(id: string): Promise<void> {
  const backup = getBackupLeads().filter((l) => l.id !== id);
  setBackupLeads(backup);

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

// Caché de Búsqueda
const CACHE_TTL_HOURS = 48;

export async function getSearchCache(
  key: string
): Promise<SearchCacheItem | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('search_cache', 'readonly');
      const store = tx.objectStore('search_cache');
      const req = store.get(key.toLowerCase().trim());

      req.onsuccess = () => {
        const item: SearchCacheItem | undefined = req.result;
        if (!item) return resolve(null);

        const ageHours = (Date.now() - item.cachedAt) / (1000 * 60 * 60);
        if (ageHours > CACHE_TTL_HOURS) {
          resolve(null);
        } else {
          resolve(item);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setSearchCache(
  key: string,
  results: BusinessLead[],
  nextPageToken?: string
): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('search_cache', 'readwrite');
      const store = tx.objectStore('search_cache');
      const item: SearchCacheItem = {
        key: key.toLowerCase().trim(),
        results,
        nextPageToken,
        cachedAt: Date.now(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not set search cache:', err);
  }
}

export async function clearSearchCache(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('search_cache', 'readwrite');
      const store = tx.objectStore('search_cache');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

// Exportación e Importación
export function exportLeadsToCsv(leads: BusinessLead[]): string {
  const headers = [
    'ID',
    'Nombre',
    'Sector',
    'Dirección',
    'Teléfono',
    'Web',
    'Tiene Web Propia',
    'Nota Oportunidad',
    'Estado CRM',
    'Valoración',
    'Número Reseñas',
    'Enlace Google Maps',
    'Servicio Recomendado',
    'Próxima Acción',
    'Notas',
  ];

  const escapeCsv = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((l) => [
    escapeCsv(l.id),
    escapeCsv(l.displayName),
    escapeCsv(l.primaryTypeDisplayName || ''),
    escapeCsv(l.formattedAddress),
    escapeCsv(l.nationalPhoneNumber || l.internationalPhoneNumber || ''),
    escapeCsv(l.websiteUri || ''),
    escapeCsv(l.hasOwnWebsite ? 'Sí' : 'No'),
    escapeCsv(l.opportunityScore),
    escapeCsv(l.status),
    escapeCsv(l.rating || ''),
    escapeCsv(l.userRatingCount || ''),
    escapeCsv(l.googleMapsUri),
    escapeCsv(l.aiAnalysis?.recommendedService || ''),
    escapeCsv(l.nextActionDate || ''),
    escapeCsv(l.notes || ''),
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

export async function exportAllToJson(): Promise<string> {
  const leads = await getAllLeads();
  const settings = inMemorySettings;
  const exportData = {
    app: 'Radar de Clientes',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: {
      sellerProfile: settings.sellerProfile,
    },
    leads,
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importFromJson(
  jsonStr: string
): Promise<{ leadsCount: number }> {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || !Array.isArray(parsed.leads)) {
    throw new Error('El archivo no contiene un formato de leads válido.');
  }
  await saveLeads(parsed.leads);
  return { leadsCount: parsed.leads.length };
}
