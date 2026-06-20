import React from 'react';
import { Search, Plus } from 'lucide-react';
import InventoryCard from './InventoryCard';
import type { Articolo } from './types';

interface GroupedArticoli {
  inArea: Articolo[];
  creata: Articolo[];
}

interface StatusMeta {
  label: string;
  className: string;
}

interface InventorySidebarPanelProps {
  categoryLabelPlural: string;
  categoryLabelSingular: string;
  filteredCount: number;
  activeCount: number;
  inAreaCount: number;
  createdCount: number;
  onCreate: () => void;
  searchCliente: string;
  setSearchCliente: (value: string) => void;
  searchCommessa: string;
  setSearchCommessa: (value: string) => void;
  searchNome: string;
  setSearchNome: (value: string) => void;
  showClienteSuggestions: boolean;
  setShowClienteSuggestions: (value: boolean) => void;
  showCommessaSuggestions: boolean;
  setShowCommessaSuggestions: (value: boolean) => void;
  showNomeSuggestions: boolean;
  setShowNomeSuggestions: (value: boolean) => void;
  clienteSuggestions: string[];
  commessaSuggestions: string[];
  nomeSuggestions: string[];
  filterType: 'all' | 'in_area' | 'creata';
  setFilterType: (value: 'all' | 'in_area' | 'creata') => void;
  onlyActionable: boolean;
  setOnlyActionable: (value: boolean) => void;
  isMobileLayout: boolean;
  groupedFilteredArticoli: GroupedArticoli;
  inventoryListRef: React.RefObject<HTMLDivElement | null>;
  selectedArticoloId?: string | null;
  mode: 'view' | 'position' | 'move';
  canSelectArticolo: (articolo: Articolo) => boolean;
  selectArticoloDisabledReason: (articolo: Articolo) => string;
  onSelect: (event: React.MouseEvent, articolo: Articolo) => void;
  getStatusMeta: (stato: Articolo['stato']) => StatusMeta;
}

export default function InventorySidebarPanel({
  categoryLabelPlural,
  categoryLabelSingular,
  filteredCount,
  activeCount,
  inAreaCount,
  createdCount,
  onCreate,
  searchCliente,
  setSearchCliente,
  searchCommessa,
  setSearchCommessa,
  searchNome,
  setSearchNome,
  showClienteSuggestions,
  setShowClienteSuggestions,
  showCommessaSuggestions,
  setShowCommessaSuggestions,
  showNomeSuggestions,
  setShowNomeSuggestions,
  clienteSuggestions,
  commessaSuggestions,
  nomeSuggestions,
  filterType,
  setFilterType,
  onlyActionable,
  setOnlyActionable,
  isMobileLayout,
  groupedFilteredArticoli,
  inventoryListRef,
  selectedArticoloId,
  mode,
  canSelectArticolo,
  selectArticoloDisabledReason,
  onSelect,
  getStatusMeta
}: InventorySidebarPanelProps) {
  return (
    <>
      <div className="sidebar-panel">
        <div className="sidebar-head">
          <div className="sidebar-title">{categoryLabelPlural}</div>
          <div className="sidebar-count">{filteredCount}</div>
        </div>
        <div className="sidebar-actions">
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onCreate}>
            <Plus size={18} /> Crea {categoryLabelSingular}
          </button>
          <div className="sidebar-badges">
            <div className="sidebar-badge">{activeCount} attive</div>
            <div className="sidebar-badge in-area">{inAreaCount} in piazzale</div>
            <div className="sidebar-badge created">{createdCount} in attesa</div>
          </div>
          <div className="search-stack">
            <div className="search-container">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Filtra per cliente..."
                className="search-input"
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                onFocus={() => setShowClienteSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClienteSuggestions(false), 200)}
              />
              {showClienteSuggestions && clienteSuggestions.length > 0 && (
                <div className="suggestions-list">
                  <div className="suggestion-header">Clienti trovati</div>
                  {clienteSuggestions.map(s => (
                    <div key={s} className="suggestion-item" onClick={() => setSearchCliente(s)}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="search-container">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Filtra per commessa..."
                className="search-input"
                value={searchCommessa}
                onChange={(e) => setSearchCommessa(e.target.value)}
                onFocus={() => setShowCommessaSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCommessaSuggestions(false), 200)}
              />
              {showCommessaSuggestions && commessaSuggestions.length > 0 && (
                <div className="suggestions-list">
                  <div className="suggestion-header">Commesse trovate</div>
                  {commessaSuggestions.map(s => (
                    <div key={s} className="suggestion-item" onClick={() => setSearchCommessa(s)}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="search-container">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Filtra per nome vasca..."
                className="search-input"
                value={searchNome}
                onChange={(e) => setSearchNome(e.target.value)}
                onFocus={() => setShowNomeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowNomeSuggestions(false), 200)}
              />
              {showNomeSuggestions && nomeSuggestions.length > 0 && (
                <div className="suggestions-list">
                  <div className="suggestion-header">Vasche trovate</div>
                  {nomeSuggestions.map(s => (
                    <div key={s} className="suggestion-item" onClick={() => setSearchNome(s)}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="filter-tabs">
            {(['all', 'in_area', 'creata'] as const).map((t) => (
              <button key={t} className={`filter-tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
                {t === 'all' ? 'Attive' : t === 'in_area' ? 'In piazzale' : 'Da posizionare'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="quick-toggle">
        <input type="checkbox" checked={onlyActionable} onChange={e => setOnlyActionable(e.target.checked)} />
        Mostra solo articoli utilizzabili in questa modalità
      </label>
      {isMobileLayout && (
        <div className="action-hint" style={{ marginBottom: '10px' }}>
          Vista compatta mobile attiva: seleziona un articolo per vedere tutti i dettagli.
        </div>
      )}
      <div className="vasca-list" ref={inventoryListRef}>
        {groupedFilteredArticoli.inArea.length > 0 && (
          <>
            <div className="suggestion-header" style={{ marginBottom: '8px' }}>In piazzale</div>
            {groupedFilteredArticoli.inArea.map((v) => (
              <InventoryCard
                key={v.id}
                articolo={v}
                selectedArticoloId={selectedArticoloId}
                mode={mode}
                canSelectArticolo={canSelectArticolo}
                selectArticoloDisabledReason={selectArticoloDisabledReason}
                onSelect={onSelect}
                getStatusMeta={getStatusMeta}
                isMobileLayout={isMobileLayout}
              />
            ))}
          </>
        )}
        {groupedFilteredArticoli.creata.length > 0 && (
          <>
            <div className="suggestion-header" style={{ marginBottom: '8px' }}>In Attesa</div>
            {groupedFilteredArticoli.creata.map((v) => (
              <InventoryCard
                key={v.id}
                articolo={v}
                selectedArticoloId={selectedArticoloId}
                mode={mode}
                canSelectArticolo={canSelectArticolo}
                selectArticoloDisabledReason={selectArticoloDisabledReason}
                onSelect={onSelect}
                getStatusMeta={getStatusMeta}
                isMobileLayout={isMobileLayout}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
