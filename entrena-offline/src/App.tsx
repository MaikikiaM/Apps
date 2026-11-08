// src/App.tsx
import React, { useState } from 'react';
import { AppDataProvider, useAppData } from './db/useAppData';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { DailyLoggerView } from './components/logger/DailyLoggerView';
import { CalendarView } from './components/calendar/CalendarView';
import { ChartsHubView } from './components/charts/ChartsHubView';
import { MathProgressView } from './components/analytics/MathProgressView';
import { SettingsView } from './components/settings/SettingsView';
import './styles/theme.css';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('logger');
  const { setSelectedDateKey } = useAppData();

  const handleSelectDateToLog = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setActiveTab('logger');
  };

  return (
    <div className="app-container">
      <TopHeader />

      {activeTab === 'logger' && <DailyLoggerView />}
      {activeTab === 'calendar' && <CalendarView onSelectDateToLog={handleSelectDateToLog} />}
      {activeTab === 'charts' && <ChartsHubView />}
      {activeTab === 'math' && <MathProgressView />}
      {activeTab === 'settings' && <SettingsView />}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppDataProvider>
      <AppContent />
    </AppDataProvider>
  );
};

export default App;
