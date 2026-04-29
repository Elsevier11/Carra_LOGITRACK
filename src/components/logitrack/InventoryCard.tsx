import React from 'react';

interface Articolo {
  id: string;
  codice: string;
  cliente: string;
  commessa: string;
  note?: string | null;
  lunghezza: number;
  altezzaVascaCm?: number | null;
  lunghezzaSolettaCm?: number | null;
  altezzaSolettaCm?: number | null;
  posizione: string | null;
  tipo: 'VASCA' | 'SOLETTA';
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
  colore: string;
}

interface InventoryCardProps {
  articolo: Articolo;
  selectedArticoloId?: string | null;
  mode: 'view' | 'position' | 'move';
  canSelectArticolo: (articolo: Articolo) => boolean;
  selectArticoloDisabledReason: (articolo: Articolo) => string;
  onSelect: (event: React.MouseEvent, articolo: Articolo) => void;
  getStatusMeta: (stato: Articolo['stato']) => { label: string; className: string };
  isMobileLayout: boolean;
}

export default function InventoryCard({
  articolo,
  selectedArticoloId,
  mode,
  canSelectArticolo,
  selectArticoloDisabledReason,
  onSelect,
  getStatusMeta,
  isMobileLayout
}: InventoryCardProps) {
  const statusMeta = getStatusMeta(articolo.stato);
  const isSelected = selectedArticoloId === articolo.id;
  const isSelectable = mode === 'view' || canSelectArticolo(articolo);
  const selectionBlockReason = mode === 'view' ? '' : selectArticoloDisabledReason(articolo);
  const showCompactCardInfo = isMobileLayout;

  return (
    <div
      className={`vasca-card ${isSelected ? 'selected' : ''}`}
      onClick={(e) => onSelect(e, articolo)}
      title={selectionBlockReason}
      style={{ cursor: isSelectable ? 'pointer' : 'not-allowed', opacity: isSelectable ? 1 : 0.7 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: articolo.colore }}></div>
          <strong>{articolo.codice}</strong>
        </div>
        <span className={statusMeta.className}>
          {statusMeta.label}
        </span>
      </div>
      <div className="vasca-info">
        <div><strong>Cliente:</strong> {articolo.cliente}</div>
        <div><strong>Commessa:</strong> {articolo.commessa}</div>
        {!showCompactCardInfo && articolo.note && <div><strong>Note:</strong> {articolo.note}</div>}
        {!showCompactCardInfo && articolo.tipo !== 'SOLETTA' && (
          <div><strong>Lunghezza:</strong> {articolo.lunghezza}cm</div>
        )}
        {!showCompactCardInfo && articolo.tipo === 'VASCA' && articolo.altezzaVascaCm && <div><strong>Altezza:</strong> {articolo.altezzaVascaCm}cm</div>}
        {!showCompactCardInfo && articolo.tipo === 'SOLETTA' && articolo.lunghezzaSolettaCm && <div><strong>Lungh. soletta:</strong> {articolo.lunghezzaSolettaCm}cm</div>}
        {!showCompactCardInfo && articolo.tipo === 'SOLETTA' && articolo.altezzaSolettaCm && <div><strong>Alt. soletta:</strong> {articolo.altezzaSolettaCm}cm</div>}
        {!showCompactCardInfo && articolo.posizione && <div><strong>Posizione:</strong> {articolo.posizione}</div>}
        {showCompactCardInfo && (
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Tocca per dettagli completi nel pannello selezionato
          </div>
        )}
      </div>
    </div>
  );
}
