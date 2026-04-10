import React from 'react';

interface Articolo {
  codice: string;
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
}

interface TabletActionBarProps {
  selectedArticolo: Articolo;
  statusLabel: string;
  movementActions: React.ReactNode;
  canDeleteSelectedArticolo: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export default function TabletActionBar({
  selectedArticolo,
  statusLabel,
  movementActions,
  canDeleteSelectedArticolo,
  onDelete,
  onEdit
}: TabletActionBarProps) {
  return (
    <div className="tablet-action-bar">
      <div className="tablet-action-meta">
        <strong>{selectedArticolo.codice}</strong>
        <span>{statusLabel}</span>
      </div>
      <div className="tablet-action-buttons">
        {movementActions}
        {selectedArticolo.stato === 'CREATA' && (
          <button
            className="btn btn-danger"
            onClick={onDelete}
            disabled={!canDeleteSelectedArticolo}
          >
            Elimina
          </button>
        )}
        <button className="btn btn-secondary" onClick={onEdit}>
          Modifica
        </button>
      </div>
    </div>
  );
}
