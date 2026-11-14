// src/App.tsx
import React, { useState } from 'react';
import { AppDataProvider, useAppData } from './db/useAppData';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { DailyLoggerView } from './components/logger/DailyLoggerView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { CalendarView } from './components/calendar/CalendarView';
import { ChartsHubView } from './components/charts/ChartsHubView';
import { MathProgressView } from './components/analytics/MathProgressView';
import { SettingsView } from './components/settings/SettingsView';
import './styles/theme.css';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('logger');
  const { setSelectedDateKey, recoveryNotice, dismissRecoveryNotice } = useAppData();

  const handleSelectDateToLog = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setActiveTab('logger');
  };

  return (
    <div className="app-container">
      <TopHeader />

      {recoveryNotice && (
        <div
          style={{
            margin: '10px 14px 0 14px',
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.16)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            color: '#6ee7b7',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <span>🛡️ {recoveryNotice}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ minHeight: '26px', padding: '2px 8px', color: '#a7f3d0' }}
            onClick={dismissRecoveryNotice}
          >
            OK
          </button>
        </div>
      )}

      {activeTab === 'logger' && <DailyLoggerView />}
      {activeTab === 'schedule' && <ScheduleView />}
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
