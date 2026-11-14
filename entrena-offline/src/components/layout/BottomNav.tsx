// src/components/layout/BottomNav.tsx
import React from 'react';
import { PenSquare, Clock, Calendar, LineChart, BrainCircuit, Settings } from 'lucide-react';

export type ActiveTab = 'logger' | 'schedule' | 'calendar' | 'charts' | 'math' | 'settings';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === 'logger' ? 'active' : ''}`}
        onClick={() => onTabChange('logger')}
        aria-label="Registrar"
      >
        <PenSquare className="bottom-nav-icon" />
        <span>Entreno</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
        onClick={() => onTabChange('schedule')}
        aria-label="Horario"
      >
        <Clock className="bottom-nav-icon" />
        <span>Horario</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onTabChange('calendar')}
        aria-label="Calendario"
      >
        <Calendar className="bottom-nav-icon" />
        <span>Agenda</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'charts' ? 'active' : ''}`}
        onClick={() => onTabChange('charts')}
        aria-label="Gráficas"
      >
        <LineChart className="bottom-nav-icon" />
        <span>Gráficas</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'math' ? 'active' : ''}`}
        onClick={() => onTabChange('math')}
        aria-label="Avance"
      >
        <BrainCircuit className="bottom-nav-icon" />
        <span>Avance</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
        aria-label="Ajustes"
      >
        <Settings className="bottom-nav-icon" />
        <span>Ajustes</span>
      </button>
    </nav>
  );
};
