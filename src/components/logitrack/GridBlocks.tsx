import React from 'react';
import type { Articolo } from './types';

export const DetailTooltip = ({ vasca, pos }: { vasca: Articolo, pos: { x: number, y: number } }) => (
  <div className="tooltip" style={{ left: pos.x + 20, top: pos.y - 20 }}>
    <div className="tooltip-header">
      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: vasca.colore }}></div>
      <span style={{ fontWeight: 800, fontSize: '18px' }}>{vasca.codice}</span>
    </div>
    <div className="tooltip-row">
      <span className="tooltip-label">Cliente:</span>
      <span className="tooltip-value">{vasca.cliente}</span>
    </div>
    <div className="tooltip-row">
      <span className="tooltip-label">Commessa:</span>
      <span className="tooltip-value">{vasca.commessa}</span>
    </div>
    {vasca.tipo !== 'SOLETTA' && (
      <div className="tooltip-row">
        <span className="tooltip-label">Lunghezza:</span>
        <span className="tooltip-value">{vasca.lunghezza}cm</span>
      </div>
    )}
    <div className="tooltip-row">
      <span className="tooltip-label">Posizione:</span>
      <span className="tooltip-value">{vasca.posizione || 'Non posizionato'}</span>
    </div>
    {vasca.tipo === 'SOLETTA' && (
      <div className="tooltip-row">
        <span className="tooltip-label">Livello:</span>
        <span className="tooltip-value">{vasca.livello}</span>
      </div>
    )}
  </div>
);

export const ArticoloBlock = React.memo(({ 
  articolo, 
  isSelected, 
  isFaded, 
  isRecentlyMoved, 
  flowClass,
  currentGridConfig,
  isScaledVascaLayout,
  filaLength,
  onClick,
  onMouseEnter,
  onMouseLeave
}: any) => {
  const style: React.CSSProperties = {
    left: isScaledVascaLayout ? `${(((articolo.offsetInizio || 0) / filaLength) * 100)}%` : (articolo.offsetInizio || 0) * currentGridConfig.pixelsPerMeter,
    width: isScaledVascaLayout ? `${((articolo.lunghezza / filaLength) * 100)}%` : articolo.lunghezza * currentGridConfig.pixelsPerMeter,
    backgroundColor: articolo.colore,
    opacity: isFaded ? 0.35 : 1,
    transform: articolo.livello > 1 ? `translateY(-${(articolo.livello - 1) * 10}px)` : 'none',
    zIndex: 10 + (articolo.livello || 1),
    top: '10%',
    position: 'absolute',
    height: '80%',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 800,
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 8px'
  };

  return (
    <div
      className={`vasca-block ${isSelected ? 'selected' : ''} ${isFaded ? 'faded' : ''} ${isRecentlyMoved ? 'gravity-drop' : ''} ${flowClass}`}
      style={style}
      onClick={(e) => onClick(e, articolo)}
      onMouseEnter={() => onMouseEnter(articolo)}
      onMouseLeave={onMouseLeave}
    >
      {articolo.codice} {articolo.livello > 1 && `(L${articolo.livello})`}
    </div>
  );
});

export const SolettaBlock = React.memo(({
  articolo,
  isSelected,
  isFaded,
  isRecentlyMoved,
  flowClass,
  levelHeight,
  onClick,
  onMouseEnter,
  onMouseLeave
}: any) => (
  <div
    className={`vasca-block ${isSelected ? 'selected' : ''} ${isFaded ? 'faded' : ''} ${isRecentlyMoved ? 'gravity-drop' : ''} ${flowClass}`}
    style={{
      left: '3px',
      top: 'auto',
      width: 'calc(100% - 6px)',
      height: `${levelHeight - 2}px`,
      bottom: `${(articolo.livello - 1) * levelHeight + 1}px`,
      backgroundColor: articolo.colore,
      opacity: isFaded ? 0.35 : 1,
      zIndex: 10 + (articolo.livello || 1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: 800,
      color: '#fff',
      padding: '0 14px 0 6px'
    }}
    onClick={(e) => onClick(e, articolo)}
    onMouseEnter={() => onMouseEnter(articolo)}
    onMouseLeave={onMouseLeave}
  >
    <span style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={articolo.codice}>{articolo.codice}</span>
    <span style={{ position: 'absolute', right: '6px', top: '2px', fontSize: '10px', opacity: 0.9 }}>L{articolo.livello}</span>
  </div>
));
