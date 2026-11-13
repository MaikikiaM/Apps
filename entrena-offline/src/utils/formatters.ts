// src/utils/formatters.ts
// Formateo de métricas deportivas y unidades

export function formatDurationMmSs(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationHuman(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const totalMins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (totalMins === 0) return `${secs}s`;
  if (totalMins >= 60) {
    const hrs = Math.floor(totalMins / 60);
    const remMins = totalMins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }
  if (secs === 0) return `${totalMins} min`;
  return `${totalMins}m ${secs}s`;
}

export function formatMeters(meters: number): string {
  if (!meters || meters <= 0) return '0 m';
  return `${Math.round(meters).toLocaleString('es-ES')} m`;
}

// Ritmo de natación: '1:45 /100m'
export function formatSwimPace(totalMeters: number, durationSeconds: number): string {
  if (!totalMeters || !durationSeconds || totalMeters <= 0 || durationSeconds <= 0) {
    return '--:-- /100m';
  }
  const paceSecondsPer100m = (durationSeconds / totalMeters) * 100;
  return `${formatDurationMmSs(paceSecondsPer100m)} /100m`;
}

export function calculateSwimPaceSecondsPer100m(totalMeters: number, durationSeconds: number): number | null {
  if (!totalMeters || !durationSeconds || totalMeters <= 0 || durationSeconds <= 0) return null;
  return (durationSeconds / totalMeters) * 100;
}

export function formatWeightKg(kg: number): string {
  if (kg === undefined || kg === null) return '-- kg';
  const formatted = kg % 1 === 0 ? kg.toString() : kg.toFixed(1);
  return `${formatted} kg`;
}

export function formatNumberWithSign(num: number, decimals: number = 1): string {
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}`;
}

export function formatPercent(val: number): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}
