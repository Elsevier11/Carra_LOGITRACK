import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Articolo {
  codice: string;
  cliente: string;
  commessa: string;
  lunghezza: number;
  altezzaVascaCm?: number | null;
  lunghezzaSolettaCm?: number | null;
  altezzaSolettaCm?: number | null;
  posizione: string | null;
  tipo: 'VASCA' | 'SOLETTA';
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
}

interface SelectionCardProps {
  selectedArticolo: Articolo;
  statusMeta: { label: string; className: string };
  isTabletLayout: boolean;
  isSelectionExpanded: boolean;
  onToggleExpanded: () => void;
  movementDateTime: string;
  setMovementDateTime: (value: string) => void;
  mode: 'view' | 'position' | 'move';
  movementActions: React.ReactNode;
  deleteDisabledReason: string;
  canDeleteSelectedArticolo: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SelectionCard({
  selectedArticolo,
  statusMeta,
  isTabletLayout,
  isSelectionExpanded,
  onToggleExpanded,
  movementDateTime,
  setMovementDateTime,
  mode,
  movementActions,
  deleteDisabledReason,
  canDeleteSelectedArticolo,
  onEdit,
  onDelete
}: SelectionCardProps) {
  return (
    <div className="selection-card">
      <div className="selection-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="selection-card-title">Selezionato</div>
          <span className={statusMeta.className}>{statusMeta.label}</span>
        </div>
        {isTabletLayout && (
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', minHeight: '32px' }}
            onClick={onToggleExpanded}
          >
            {isSelectionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      <div className="selection-card-code">{selectedArticolo.codice}</div>
      {(!isTabletLayout || isSelectionExpanded) && (
        <>
          <div className="selection-card-grid">
            <div><strong>Cliente:</strong> {selectedArticolo.cliente}</div>
            <div><strong>Commessa:</strong> {selectedArticolo.commessa}</div>
            {selectedArticolo.tipo !== 'SOLETTA' && (
              <div><strong>Lunghezza:</strong> {selectedArticolo.lunghezza}cm</div>
            )}
            {selectedArticolo.tipo === 'VASCA' && selectedArticolo.altezzaVascaCm && (
              <div><strong>Altezza:</strong> {selectedArticolo.altezzaVascaCm}cm</div>
            )}
            {selectedArticolo.tipo === 'SOLETTA' && selectedArticolo.lunghezzaSolettaCm && (
              <div><strong>Lungh. soletta:</strong> {selectedArticolo.lunghezzaSolettaCm}cm</div>
            )}
            {selectedArticolo.tipo === 'SOLETTA' && selectedArticolo.altezzaSolettaCm && (
              <div><strong>Alt. soletta:</strong> {selectedArticolo.altezzaSolettaCm}cm</div>
            )}
            {selectedArticolo.posizione && <div><strong>Posizione:</strong> {selectedArticolo.posizione}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Data/ora movimento</label>
            <input
              type="datetime-local"
              className="form-input"
              value={movementDateTime}
              onChange={(e) => setMovementDateTime(e.target.value)}
            />
          </div>
        </>
      )}
      {mode === 'view' ? (
        <div style={{ display: 'grid', gap: '10px' }} className="selection-action-block">
          <div className="selection-actions">
            {movementActions}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'center' }}
              onClick={onEdit}
            >
              Modifica dati
            </button>
            <span style={{ display: 'flex' }} title={deleteDisabledReason}>
              <button
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={onDelete}
                disabled={!canDeleteSelectedArticolo}
              >
                Elimina
              </button>
            </span>
          </div>
        </div>
      ) : (
        <div className="action-hint" style={{ marginBottom: 0 }}>
          Conferma una posizione sulla planimetria o premi <strong>Esc</strong> per annullare.
        </div>
      )}
    </div>
  );
}
