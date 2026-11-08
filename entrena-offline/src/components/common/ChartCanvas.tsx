// src/components/common/ChartCanvas.tsx
// Componente de renderizado de gráficas con Chart.js nativo 100% offline y responsivo

import React, { useEffect, useRef } from 'react';
import {
  Chart,
  ChartConfiguration,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Registrar controladores y elementos necesarios una sola vez
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartCanvasProps {
  config: ChartConfiguration;
  height?: number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({ config, height = 240 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destruir instancia anterior si existía para evitar fugas y duplicados
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Ajustes por defecto de alto contraste para tema oscuro
    const mergedConfig: ChartConfiguration = {
      ...config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        layout: {
          padding: { top: 6, bottom: 4, left: 2, right: 6 }
        },
        plugins: {
          legend: {
            display: config.options?.plugins?.legend?.display ?? true,
            position: config.options?.plugins?.legend?.position ?? 'top',
            labels: {
              color: '#94a3b8',
              font: { size: 11, weight: 'bold' },
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            ...config.options?.plugins?.tooltip
          },
          ...config.options?.plugins
        },
        scales: config.options?.scales
          ? {
              ...config.options.scales
            }
          : undefined,
        ...config.options
      }
    };

    chartInstanceRef.current = new Chart(ctx, mergedConfig);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className="chart-wrapper" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
};
