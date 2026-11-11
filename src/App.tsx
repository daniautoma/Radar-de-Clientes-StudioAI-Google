import React, { useEffect, useState } from 'react';
import { AppSettings, BusinessLead } from './types';
import { DEFAULT_SETTINGS, getAllLeads, getSettings, saveSettings } from './services/db';
import { NavView, Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SearchView } from './views/SearchView';
import { BusinessDetailView } from './views/BusinessDetailView';
import { NichesRadarView } from './views/NichesRadarView';
import { LeadsView } from './views/LeadsView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('search');
  const [selectedLead, setSelectedLead] = useState<BusinessLead | null>(null);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Parámetros de búsqueda compartidos para saltar desde el Radar de Nichos
  const [searchLocation, setSearchLocation] = useState('Dos Hermanas, Sevilla');
  const [searchNiche, setSearchNiche] = useState('talleres mecánicos');

  // Carga inicial de datos de IndexedDB
  useEffect(() => {
    async function loadInitialData() {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);

      const loadedLeads = await getAllLeads();
      setLeads(loadedLeads);

      // Aplicar tema en el DOM
      applyTheme(loadedSettings.theme);
    }
    loadInitialData();
  }, []);

  const applyTheme = (theme: 'dark' | 'light') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.className =
        'bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.className =
        'bg-slate-100 text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-700';
    }
  };

  const handleToggleTheme = async () => {
    if (!settings) return;
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = await saveSettings({ theme: newTheme });
    setSettings(updated);
    applyTheme(newTheme);
  };

  const refreshLeads = async () => {
    const updatedLeads = await getAllLeads();
    setLeads(updatedLeads);
    const updatedSettings = await getSettings();
    setSettings(updatedSettings);
  };

  const handleOpenLead = (lead: BusinessLead) => {
    setSelectedLead(lead);
    setCurrentView('detail');
  };

  const handleLeadUpdated = (updated: BusinessLead) => {
    setSelectedLead(updated);
    refreshLeads();
  };

  const handleSelectNicheForSearch = (loc: string, nic: string) => {
    setSearchLocation(loc);
    setSearchNiche(nic);
    setCurrentView('search');
  };

  const hasApiKey = Boolean(settings.googleCloudApiKey?.trim());

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Barra lateral de navegación */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        savedLeadsCount={leads.length}
        settings={settings}
        onToggleTheme={handleToggleTheme}
        selectedLeadName={selectedLead?.displayName}
      />

      {/* Área principal de contenido */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior de navegación y estado */}
        <Header
          currentView={currentView}
          selectedLeadName={selectedLead?.displayName}
          hasApiKey={hasApiKey}
          onNavigateToSettings={() => setCurrentView('settings')}
        />

        {/* Vistas dinámicas */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'search' && (
            <SearchView
              hasApiKey={hasApiKey}
              onGoToSettings={() => setCurrentView('settings')}
              onOpenLead={handleOpenLead}
              onLeadsUpdated={refreshLeads}
              onSettingsUpdated={(updated) => setSettings(updated)}
              initialLocation={searchLocation}
              initialNiche={searchNiche}
            />
          )}

          {currentView === 'detail' && selectedLead && (
            <BusinessDetailView
              lead={selectedLead}
              onBack={() => setCurrentView('search')}
              onLeadUpdated={handleLeadUpdated}
            />
          )}

          {currentView === 'niches' && (
            <NichesRadarView
              settings={settings}
              hasApiKey={hasApiKey}
              onGoToSettings={() => setCurrentView('settings')}
              onSelectNicheForSearch={handleSelectNicheForSearch}
              onSettingsUpdated={(updated) => setSettings(updated)}
            />
          )}

          {currentView === 'leads' && (
            <LeadsView
              leads={leads}
              onOpenLead={handleOpenLead}
              onLeadsUpdated={refreshLeads}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              onSettingsSaved={(updated) => setSettings(updated)}
              onToggleTheme={handleToggleTheme}
              onLeadsUpdated={refreshLeads}
            />
          )}
        </main>
      </div>
    </div>
  );
}
