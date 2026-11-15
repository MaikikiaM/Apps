// src/components/schedule/MissedReasonModal.tsx
// Diálogo modal ligero para registrar o editar el motivo cuando un evento se marca como no cumplido

import React, { useEffect, useMemo, useState } from 'react';
import { Link2, MessageSquareWarning, X } from 'lucide-react';
import { formatFullSpanishDate } from '../../utils/dates';
import { normalizeReasonGroupKey } from '../../utils/scheduleStats';

export interface ExistingReasonSuggestion {
  groupKey: string;
  displayLabel: string;
  count: number;
}

interface MissedReasonModalProps {
  isOpen: boolean;
  eventTitle: string;
  dateKey: string;
  initialReason?: string;
  existingGroups: ExistingReasonSuggestion[];
  onSave: (reason: string) => void;
  onCancel: () => void;
}

const DEFAULT_REASON_CHIPS = [
  'Falta de tiempo',
  'Cansancio',
  'Trabajo / Estudio',
  'Imprevisto',
  'Descanso / Salud'
];

export const MissedReasonModal: React.FC<MissedReasonModalProps> = ({
  isOpen,
  eventTitle,
  dateKey,
  initialReason = '',
  existingGroups,
  onSave,
  onCancel
}) => {
  const [reasonText, setReasonText] = useState<string>(initialReason);

  useEffect(() => {
    if (isOpen) {
      setReasonText(initialReason);
    }
  }, [isOpen, initialReason]);

  const normalizedInput = normalizeReasonGroupKey(reasonText);

  const matchedExistingGroup = useMemo(() => {
    if (!normalizedInput) return null;
    return existingGroups.find(g => g.groupKey === normalizedInput) || null;
  }, [normalizedInput, existingGroups]);

  const quickChips = useMemo(() => {
    const chips: { label: string; count?: number }[] = [];
    const seenKeys = new Set<string>();

    for (const grp of existingGroups.slice(0, 6)) {
      if (!seenKeys.has(grp.groupKey)) {
        seenKeys.add(grp.groupKey);
        chips.push({ label: grp.displayLabel, count: grp.count });
      }
    }

    for (const def of DEFAULT_REASON_CHIPS) {
      const k = normalizeReasonGroupKey(def);
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        chips.push({ label: def });
      }
      if (chips.length >= 8) break;
    }

    return chips;
  }, [existingGroups]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(reasonText.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Motivo de no cumplido"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <form
        className="card"
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          marginBottom: 0,
          background: '#0f172a',
          borderColor: 'rgba(244, 63, 94, 0.55)',
          boxShadow: '0 22px 55px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fb7185', fontWeight: 800, fontSize: '0.86rem' }}>
              <MessageSquareWarning size={16} />
              <span>¿Por qué no se cumplió?</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)', marginTop: '3px' }}>
              {eventTitle}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {formatFullSpanishDate(dateKey)}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            style={{ width: 30, height: 30, minHeight: 30 }}
            onClick={onCancel}
            aria-label="Cancelar motivo"
          >
            <X size={16} />
          </button>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Ej: Falta de tiempo, cansancio, lluvia..."
            value={reasonText}
            onChange={e => setReasonText(e.target.value)}
            maxLength={140}
            autoFocus
          />
          {matchedExistingGroup && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '0.72rem',
                color: '#fda4af',
                background: 'rgba(244, 63, 94, 0.14)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: '8px',
                padding: '5px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Link2 size={12} />
              <span>
                Se clasificará junto a «{matchedExistingGroup.displayLabel}» ({matchedExistingGroup.count}{' '}
                {matchedExistingGroup.count === 1 ? 'vez antes' : 'veces antes'}).
              </span>
            </div>
          )}
        </div>

        {quickChips.length > 0 && (
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              Sugerencias rápidas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickChips.map(chip => {
                const selected = normalizeReasonGroupKey(chip.label) === normalizedInput && normalizedInput !== '';
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setReasonText(chip.label)}
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '5px 9px',
                      borderRadius: '9999px',
                      border: `1px solid ${selected ? '#f43f5e' : 'var(--border-color)'}`,
                      background: selected ? 'rgba(244, 63, 94, 0.22)' : 'var(--bg-subtle)',
                      color: selected ? '#fda4af' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {chip.label}
                    {chip.count !== undefined ? ` (${chip.count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '40px' }}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-sm"
            style={{
              minHeight: '40px',
              background: 'rgba(244, 63, 94, 0.26)',
              border: '1px solid #f43f5e',
              color: '#ffe4e6',
              fontWeight: 800
            }}
          >
            {reasonText.trim() ? 'Guardar motivo' : 'Marcar sin motivo'}
          </button>
        </div>
      </form>
    </div>
  );
};
