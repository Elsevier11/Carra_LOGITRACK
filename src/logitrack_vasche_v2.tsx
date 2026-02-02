import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Trash2, Move, Package, AlertCircle, Check, X, Calendar, Clock, User, Hash, ChevronUp, ChevronDown } from 'lucide-react';

const uuidv4 = () => crypto.randomUUID();

/**
 * TYPES & INTERFACES
 */
interface Vasca {
  id: string;
  codice: string;
  cliente: string;
  commessa: string;
  lunghezza: number;
  posizione: string | null;
  colore: string;
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
  dataCreazione: string;
}

interface AppUser {
  id: string;
  username: string;
  ruolo: 'ADMIN' | 'OPERATORE';
}

interface LogEntry {
  id: string;
  tipo: 'CREAZIONE' | 'ENTRATA' | 'SPOSTAMENTO' | 'MOVIMENTAZIONE' | 'USCITA' | 'SPEDIZIONE';
  vascaId?: string;
  vascaCodice: string;
  vascaColore: string;
  dettagli: string;
  utenteNome?: string;
  timestamp: number;
}

interface GridConfig {
  rows: string[];
  cols: number[];
  slotLength: number;
}

/**
 * CONSTANTS
 */
const GRID_CONFIG: GridConfig = {
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  cols: Array.from({ length: 10 }, (_, i) => i + 1),
  slotLength: 2
};

const TANK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

/**
 * UI SUB-COMPONENTS
 */

const StatCard = ({ label, value, color }: { label: string, value: number, color?: string }) => (
  <div className="stat-card" style={color ? { borderLeftColor: color } : {}}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);

const DetailTooltip = ({ vasca, pos }: { vasca: Vasca, pos: { x: number, y: number } }) => (
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
    <div className="tooltip-row">
      <span className="tooltip-label">Lunghezza:</span>
      <span className="tooltip-value">{vasca.lunghezza}m</span>
    </div>
    <div className="tooltip-row">
      <span className="tooltip-label">Posizione:</span>
      <span className="tooltip-value">{vasca.posizione}</span>
    </div>
  </div>
);

/**
 * MAIN COMPONENT
 */
const LogiTrackVasche = () => {
  // --- States ---
  const [vasche, setVasche] = useState<Vasca[]>([]);
  const [registro, setRegistro] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'logs' | 'utenti'>('grid');
  const [utenti, setUtenti] = useState<(AppUser & { password?: string })[]>([]);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', ruolo: 'OPERATORE' as 'ADMIN' | 'OPERATORE' });
  const [searchCliente, setSearchCliente] = useState('');
  const [searchCommessa, setSearchCommessa] = useState('');
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);
  const [showCommessaSuggestions, setShowCommessaSuggestions] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'in_area' | 'creata' | 'spedite'>('all');
  const [selectedVasca, setSelectedVasca] = useState<Vasca | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [mode, setMode] = useState<'view' | 'position' | 'move'>('view');
  const [ghostPosition, setGhostPosition] = useState<string | null>(null);
  const [hoveredVasca, setHoveredVasca] = useState<Vasca | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({ codice: '', cliente: '', commessa: '', lunghezza: '' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof LogEntry | 'vascaCodice'; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- Persistence (API) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resVasche, resRegistro] = await Promise.all([
          fetch('http://localhost:3001/api/vasche'),
          fetch('http://localhost:3001/api/registro')
        ]);
        const dataVasche = await resVasche.json();
        const dataRegistro = await resRegistro.json();
        setVasche(dataVasche);
        setRegistro(dataRegistro);
      } catch (err) {
        console.error('Errore nel caricamento dati dal backend:', err);
      }
    };
    if (currentUser) {
      fetchData();
      if (currentUser.ruolo === 'ADMIN') fetchUtenti();
    }
  }, [currentUser]);

  const fetchUtenti = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/utenti');
      const data = await res.json();
      setUtenti(data);
    } catch (err) {
      console.error('Errore nel caricamento utenti:', err);
    }
  };

  const handleCreateUser = async () => {
    if (!userFormData.username || !userFormData.password) {
      alert('Inserire username e password');
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/utenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData)
      });
      if (res.ok) {
        fetchUtenti();
        setUserFormData({ username: '', password: '', ruolo: 'OPERATORE' });
        alert('Utente creato con successo');
      }
    } catch (err) {
      console.error('Errore creazione utente:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo utente?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/utenti/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUtenti();
    } catch (err) {
      console.error('Errore eliminazione utente:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
      } else {
        setLoginError('Credenziali non valide');
      }
    } catch (err) {
      setLoginError('Errore di connessione al server');
    }
  };

  // Helper to get next color
  const getNextColor = useCallback(() => {
    const currentColors = vasche.map(v => v.colore);
    for (const color of TANK_COLORS) {
      if (!currentColors.includes(color)) {
        return color;
      }
    }
    return TANK_COLORS[Math.floor(Math.random() * TANK_COLORS.length)];
  }, [vasche]);

  // --- Logging ---
  const addLog = useCallback(async (tipo: LogEntry['tipo'], vasca: Vasca, dettagli: string) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      tipo,
      vascaId: vasca.id,
      vascaCodice: vasca.codice,
      vascaColore: vasca.colore,
      dettagli,
      utenteNome: currentUser?.username
    };

    try {
      await fetch('http://localhost:3001/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      setRegistro(prev => [newLog, ...prev]);
    } catch (err) {
      console.error('Errore nel salvataggio del log:', err);
    }
  }, [currentUser]);

  // --- Grid Logic ---
  const getOccupiedCells = useCallback((posizione: string | null, lunghezza: number) => {
    if (!posizione) return [];
    const match = posizione.match(/([A-Z])(\d+)/);
    if (!match) return [];
    const [, row, colStr] = match;
    const startCol = parseInt(colStr);
    const numCells = Math.ceil(lunghezza / GRID_CONFIG.slotLength);
    const cells = [];
    for (let i = 0; i < numCells; i++) {
      cells.push(`${row}${String(startCol + i).padStart(2, '0')}`);
    }
    return cells;
  }, []);

  const isPositionAvailable = useCallback((posizione: string, lunghezza: number, excludeId: string | null = null) => {
    const cellsNeeded = getOccupiedCells(posizione, lunghezza);
    if (cellsNeeded.length === 0) return { available: false, reason: 'Posizione non valida' };

    const lastCell = cellsNeeded[cellsNeeded.length - 1];
    const matchLast = lastCell.match(/([A-Z])(\d+)/);
    if (!matchLast) return { available: false, reason: 'Errore parser' };

    const lastCol = parseInt(matchLast[2]);
    if (lastCol > GRID_CONFIG.cols.length) {
      return { available: false, reason: 'Spazio insufficiente' };
    }

    for (const v of vasche) {
      if (v.id === excludeId || v.stato !== 'IN_AREA' || !v.posizione) continue;
      const occupiedCells = getOccupiedCells(v.posizione, v.lunghezza);
      if (cellsNeeded.some(cell => occupiedCells.includes(cell))) {
        return { available: false, reason: `Occupata da ${v.codice}` };
      }
    }
    return { available: true };
  }, [vasche, getOccupiedCells]);

  // --- Computed Data ---
  const filteredVasche = useMemo(() => {
    return vasche.filter(v => {
      const matchCliente = v.cliente.toLowerCase().includes(searchCliente.toLowerCase());
      const matchCommessa = v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());

      // La ricerca deve essere effettuata esclusivamente tra le vasche in giacenza (IN_AREA)
      const isSearching = searchCliente !== '' || searchCommessa !== '';
      if (isSearching && v.stato !== 'IN_AREA') return false;

      const matchType =
        filterType === 'all' ||
        (filterType === 'in_area' && v.stato === 'IN_AREA') ||
        (filterType === 'creata' && v.stato === 'CREATA') ||
        (filterType === 'spedite' && v.stato === 'SPEDITA');
      return matchCliente && matchCommessa && matchType;
    });
  }, [vasche, searchCliente, searchCommessa, filterType]);

  const clienteSuggestions = useMemo(() => {
    if (!searchCliente) return [];
    return Array.from(new Set(
      vasche.filter(v => v.stato === 'IN_AREA')
        .map(v => v.cliente)
        .filter(c => c.toLowerCase().includes(searchCliente.toLowerCase()) && c.toLowerCase() !== searchCliente.toLowerCase())
    )).slice(0, 5);
  }, [vasche, searchCliente]);

  const commessaSuggestions = useMemo(() => {
    if (!searchCommessa) return [];
    return Array.from(new Set(
      vasche.filter(v => v.stato === 'IN_AREA')
        .map(v => v.commessa)
        .filter(c => c.toLowerCase().includes(searchCommessa.toLowerCase()) && c.toLowerCase() !== searchCommessa.toLowerCase())
    )).slice(0, 5);
  }, [vasche, searchCommessa]);

  const sortedRegistro = useMemo(() => {
    const sortableItems = [...registro];
    sortableItems.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof LogEntry];
      let bValue: any = b[sortConfig.key as keyof LogEntry];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [registro, sortConfig]);

  const requestSort = (key: keyof LogEntry | 'vascaCodice') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const occupancyMap = useMemo(() => {
    const map: Record<string, { vasca: Vasca; isFirst: boolean }> = {};
    vasche.filter(v => v.stato === 'IN_AREA' && v.posizione).forEach(v => {
      getOccupiedCells(v.posizione, v.lunghezza).forEach((cell, idx) => {
        map[cell] = { vasca: v, isFirst: idx === 0 };
      });
    });
    return map;
  }, [vasche, getOccupiedCells]);

  const ghostCells = useMemo(() => {
    if (!ghostPosition || !selectedVasca) return [];
    return getOccupiedCells(ghostPosition, selectedVasca.lunghezza);
  }, [ghostPosition, selectedVasca, getOccupiedCells]);

  // --- Handlers ---
  const handleCreateVasca = async () => {
    const { codice, cliente, commessa, lunghezza } = formData;
    if (!codice || !cliente || !commessa || !lunghezza) {
      alert('Tutti i campi sono obbligatori');
      return;
    }

    // Check for duplicate code locally
    const isDuplicate = vasche.some(v => v.codice.trim().toUpperCase() === codice.trim().toUpperCase());
    if (isDuplicate) {
      alert(`Il codice vasca '${codice}' esiste già.`);
      return;
    }

    const newVasca: Vasca = {
      id: uuidv4(),
      codice,
      cliente,
      commessa,
      lunghezza: Number(lunghezza),
      posizione: null,
      stato: 'CREATA',
      colore: getNextColor(),
      dataCreazione: new Date().toISOString()
    };

    try {
      const res = await fetch('http://localhost:3001/api/vasche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newVasca.id,
          codice: newVasca.codice,
          cliente: newVasca.cliente,
          commessa: newVasca.commessa,
          lunghezza: newVasca.lunghezza,
          colore: newVasca.colore,
          stato: newVasca.stato,
          dataCreazione: newVasca.dataCreazione
        })
      });

      if (res.ok) {
        setVasche(prev => [...prev, newVasca]);
        addLog('CREAZIONE', newVasca, `Creata nuova vasca per cliente ${newVasca.cliente}`);
        setShowCreateModal(false);
        setFormData({ codice: '', cliente: '', commessa: '', lunghezza: '' });
      } else {
        const errorData = await res.json();
        const errorMessage = errorData.error || 'Errore nella creazione della vasca.';
        alert(errorMessage);
        console.error('Failed to create vasca:', errorData);
      }
    } catch (err) {
      console.error('Errore nella creazione della vasca:', err);
      alert('Errore di rete o del server.');
    }
  };

  const moveVasca = async (vascaId: string, newPos: string | null, newState: Vasca['stato'], logType: LogEntry['tipo'], logDetails: string) => {
    const vasca = vasche.find(v => v.id === vascaId);
    if (!vasca) return;

    try {
      const res = await fetch(`http://localhost:3001/api/vasche/${vascaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posizione: newPos, stato: newState })
      });
      if (res.ok) {
        setVasche(prev => prev.map(v =>
          v.id === vascaId ? { ...v, posizione: newPos, stato: newState } : v
        ));
        addLog(logType, { ...vasca, posizione: newPos, stato: newState }, logDetails);
        setMode('view');
        setSelectedVasca(null);
        setGhostPosition(null);
      } else {
        console.error('Failed to move vasca:', await res.text());
        alert('Errore nello spostamento della vasca.');
      }
    } catch (err) {
      console.error('Errore nello spostamento della vasca:', err);
      alert('Errore di rete o del server.');
    }
  };

  const handlePositionVasca = (pos: string) => {
    if (!selectedVasca || mode !== 'position') return;
    const check = isPositionAvailable(pos, selectedVasca.lunghezza);
    if (!check.available) {
      alert(`❌ ${check.reason}`);
      return;
    }
    setShowConfirmModal({
      message: `Posizionare ${selectedVasca.codice} in ${pos}?`,
      onConfirm: () => {
        moveVasca(selectedVasca.id, pos, 'IN_AREA', 'ENTRATA', `Posizionata in ${pos}`);
        setShowConfirmModal(null);
      }
    });
  };

  const handleMoveVasca = (pos: string) => {
    if (!selectedVasca || mode !== 'move') return;
    const check = isPositionAvailable(pos, selectedVasca.lunghezza, selectedVasca.id);
    if (!check.available) {
      alert(`❌ ${check.reason}`);
      return;
    }
    setShowConfirmModal({
      message: `Spostare ${selectedVasca.codice} da ${selectedVasca.posizione} a ${pos}?`,
      onConfirm: () => {
        moveVasca(selectedVasca.id, pos, 'IN_AREA', 'MOVIMENTAZIONE', `Spostata da ${selectedVasca.posizione} a ${pos}`);
        setShowConfirmModal(null);
      }
    });
  };

  const handleShipVasca = async (vasca: Vasca) => {
    try {
      const res = await fetch(`http://localhost:3001/api/vasche/${vasca.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posizione: null, stato: 'SPEDITA' })
      });
      if (res.ok) {
        setVasche(prev => prev.map(v =>
          v.id === vasca.id ? { ...v, posizione: null, stato: 'SPEDITA' } : v
        ));
        addLog('SPEDIZIONE', vasca, 'Vasca spedita correttamente');
        setSelectedVasca(null);
      } else {
        console.error('Failed to ship vasca:', await res.text());
        alert('Errore nella spedizione della vasca.');
      }
    } catch (err) {
      console.error('Errore nella spedizione della vasca:', err);
      alert('Errore di rete o del server.');
    }
  };

  const handleScaricaVasca = (v: Vasca) => {
    setShowConfirmModal({
      message: `Scaricare ${v.codice}? Le piazzole saranno liberate.`,
      onConfirm: () => {
        handleShipVasca(v);
        setShowConfirmModal(null);
      }
    });
  };

  const clearLog = async () => {
    if (confirm('Pulire tutto il registro?')) {
      try {
        const res = await fetch('http://localhost:3001/api/registro', {
          method: 'DELETE'
        });
        if (res.ok) {
          setRegistro([]);
        } else {
          console.error('Failed to clear log:', await res.text());
          alert('Errore nella pulizia del log.');
        }
      } catch (err) {
        console.error('Errore nella pulizia del log:', err);
        alert('Errore di rete o del server.');
      }
    }
  };

  // --- Render ---
  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
        .app { max-width: 1400px; margin: 0 auto; padding: 24px; position: relative; }
        
        /* Layout Blocks */
        .header { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; border-top: 4px solid #3b82f6; }
        .header h1 { font-size: 28px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .header p { color: #64748b; font-size: 14px; }
        
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #3b82f6; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .stat-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 28px; font-weight: 800; color: #0f172a; }
        
        .controls { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
        .search-box { flex: 1; min-width: 300px; display: flex; gap: 12px; }
        .search-container { position: relative; flex: 1; }
        .search-input { width: 100%; padding: 12px 40px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; }
        .search-input:focus { outline: none; border-color: #3b82f6; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        
        .filter-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 10px; }
        .filter-tab { padding: 8px 16px; border: none; background: transparent; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600; color: #64748b; transition: all 0.2s; }
        .filter-tab.active { background: white; color: #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        
        .btn { padding: 12px 24px; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: opacity 0.2s; }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-secondary { background: #e2e8f0; color: #475569; }
        .btn-success { background: #10b981; color: white; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-danger { background: #ef4444; color: white; }
        
        .nav-tabs { display: flex; gap: 32px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; }
        .nav-tab { padding: 12px 4px; font-weight: 700; font-size: 15px; color: #64748b; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
        .nav-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
        
        /* Grid Engine */
        .content { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
        .grid-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .grid-container { overflow-x: auto; padding: 10px; }
        .grid-header { display: grid; grid-template-columns: 60px repeat(10, 60px); gap: 4px; margin-bottom: 8px; }
        .grid-row { display: grid; grid-template-columns: 60px repeat(10, 60px); gap: 4px; margin-bottom: 4px; }
        .cell-header { height: 40px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #1e293b; background: #f1f5f9; border-radius: 8px; }
        .grid-cell { height: 60px; border: 2px solid #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; background: white; position: relative; transition: all 0.2s ease; }
        .grid-cell:hover { border-color: #3b82f6; transform: scale(1.02); z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .grid-cell.occupied { color: white; border-color: rgba(0,0,0,0.05); }
        .grid-cell.ghost { background: rgba(59, 130, 246, 0.15); border: 2px dashed #3b82f6; }
        .grid-cell.ghost.invalid { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; }
        .grid-cell.selected { box-shadow: 0 0 0 3px #f59e0b; }
        .grid-cell.faded { opacity: 0.35; filter: saturate(0.4); }
        .cell-label { font-size: 10px; font-weight: 800; position: absolute; top: 6px; left: 6px; letter-spacing: 0.5px; }
        
        /* Sidebar */
        .sidebar { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .vasca-list { max-height: 600px; overflow-y: auto; padding-right: 8px; }
        .vasca-card { padding: 16px; border: 2px solid #f1f5f9; border-radius: 12px; margin-bottom: 16px; cursor: pointer; transition: all 0.2s; }
        .vasca-card:hover { border-color: #cbd5e1; background: #f8fafc; }
        .vasca-card.selected { border-color: #3b82f6; background: #eff6ff; }
        .vasca-info { font-size: 13px; color: #475569; margin-top: 10px; display: grid; gap: 4px; }
        
        /* Modals & Tooltips */
        .tooltip { position: fixed; pointer-events: none; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px; color: white; min-width: 280px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.4); z-index: 10000; transition: opacity 0.2s; }
        .tooltip-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tooltip-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
        .tooltip-label { color: #94a3b8; font-weight: 500; }
        .tooltip-value { font-weight: 700; color: #f8fafc; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 99999; }
        .modal { background: white; padding: 32px; border-radius: 18px; max-width: 500px; width: 90%; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.5); position: relative; pointer-events: auto; }
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #64748b; }
        .form-input { width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; transition: border-color 0.2s; }
        .form-input:focus { border-color: #3b82f6; outline: none; }
        
        .alert { padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; background: #ebf5ff; color: #1e40af; display: flex; gap: 14px; align-items: flex-start; border: 1px solid #bfdbfe; }
        
        /* Suggestions */
        .suggestions-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; margin-top: 4px; z-index: 1000; max-height: 220px; overflow-y: auto; padding: 4px; }
        .suggestion-item { padding: 8px 12px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 6px; color: #475569; }
        .suggestion-item:hover { background: #f1f5f9; color: #3b82f6; }
        .suggestion-header { padding: 6px 12px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }

        /* Logs */
        .log-table { width: 100%; border-collapse: collapse; }
        .log-table th { text-align: left; padding: 14px 20px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; cursor: pointer; user-select: none; transition: background 0.2s; }
        .log-table th:hover { background: #f8fafc; color: #3b82f6; }
        .log-table td { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .log-type { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        .log-operator { display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 12px; font-weight: 600; }
        .log-type.creazione { background: #f1f5f9; color: #64748b; }
        .log-type.entrata { background: #dcfce7; color: #15803d; }
        .log-type.spostamento, .log-type.movimentazione { background: #fef3c7; color: #b45309; }
        .log-type.uscita, .log-type.spedizione { background: #fee2e2; color: #b91c1c; }
      `}</style>

      {/* LOGIN OVERLAY - EXCLUSIVE */}
      {!currentUser ? (
        <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 999999, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div style={{ background: '#eff6ff', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Package size={32} color="#3b82f6" />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Benvenuto in LogiTrack</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Accedi per gestire la movimentazione vasche</p>

            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="admin"
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              {loginError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, marginTop: '-12px', marginBottom: '16px' }}>{loginError}</p>}
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Accedi al Sistema
              </button>
            </form>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '12px' }}>
              Gestione Vasche Industriali v2.6 - Accesso Riservato
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* HEADER & STATS */}
          <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 100 }}>
            <div>
              <h1><Package size={36} color="#3b82f6" /> LogiTrack</h1>
              <p>Dashboard operativa per la gestione dislocazione vasche industriali</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}>
                  <User size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  {currentUser?.username.toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => { setCurrentUser(null); setLoginForm({ username: '', password: '' }); setLoginError(''); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                LOGOUT
              </button>
            </div>
          </div>

          <div className="stats" style={{ position: 'relative', zIndex: 1 }}>
            <StatCard label="Totali caricate" value={vasche.length} />
            <StatCard label="In piazzola" value={vasche.filter(v => v.stato === 'IN_AREA').length} color="#10b981" />
            <StatCard label="In attesa" value={vasche.filter(v => v.stato === 'CREATA').length} color="#f59e0b" />
            <StatCard label="Spedite" value={vasche.filter(v => v.stato === 'SPEDITA').length} color="#ef4444" />
          </div>

          {/* CONTROLS */}
          <div className="controls" style={{ position: 'relative', zIndex: 10 }}>
            <div className="search-box">
              <div className="search-container">
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Cerca cliente (solo in giacenza)..."
                  className="search-input"
                  value={searchCliente}
                  onChange={(e) => setSearchCliente(e.target.value)}
                  onFocus={() => setShowClienteSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClienteSuggestions(false), 200)}
                />
                {showClienteSuggestions && clienteSuggestions.length > 0 && (
                  <div className="suggestions-list">
                    <div className="suggestion-header">Suggerimenti Clienti</div>
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
                  placeholder="Cerca commessa (solo in giacenza)..."
                  className="search-input"
                  value={searchCommessa}
                  onChange={(e) => setSearchCommessa(e.target.value)}
                  onFocus={() => setShowCommessaSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCommessaSuggestions(false), 200)}
                />
                {showCommessaSuggestions && commessaSuggestions.length > 0 && (
                  <div className="suggestions-list">
                    <div className="suggestion-header">Suggerimenti Commesse</div>
                    {commessaSuggestions.map(s => (
                      <div key={s} className="suggestion-item" onClick={() => setSearchCommessa(s)}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-tabs">
              {(['all', 'in_area', 'creata', 'spedite'] as const).map((t) => (
                <button key={t} className={`filter-tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
                  {t === 'all' ? 'Tutte' : t === 'in_area' ? 'In Area' : t === 'creata' ? 'In Attesa' : 'Spedite'}
                </button>
              ))}
            </div>

            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={20} /> Nuova Vasca
            </button>
          </div>

          {/* NAVIGATION */}
          <div className="nav-tabs" style={{ position: 'relative', zIndex: 1 }}>
            <div className={`nav-tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
              Planimetria Spazi
            </div>
            <div className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
              Registro Operazioni
            </div>
            {currentUser?.ruolo === 'ADMIN' && (
              <div className={`nav-tab ${activeTab === 'utenti' ? 'active' : ''}`} onClick={() => setActiveTab('utenti')}>
                Gestione Utenti
              </div>
            )}
          </div>

          {/* MAIN CONTENT */}
          {activeTab === 'grid' ? (
            <>
              {mode !== 'view' && (
                <div className="alert">
                  <AlertCircle size={22} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                      {mode === 'position' ? 'Modalità Posizionamento' : 'Modalità Spostamento'}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      Scegli una piazzola libera per la vasca <strong>{selectedVasca?.codice}</strong> ({selectedVasca?.lunghezza}m)
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}
                      onClick={() => { setMode('view'); setSelectedVasca(null); setGhostPosition(null); }}
                    >
                      <X size={14} /> Cancella operazione
                    </button>
                  </div>
                </div>
              )}

              <div className="content" style={{ position: 'relative', zIndex: 1 }}>
                <div className="grid-section">
                  <div className="grid-container">
                    <div className="grid-header">
                      <div className="cell-header"></div>
                      {GRID_CONFIG.cols.map(c => <div key={c} className="cell-header">{String(c).padStart(2, '0')}</div>)}
                    </div>
                    {GRID_CONFIG.rows.map(row => (
                      <div key={row} className="grid-row">
                        <div className="cell-header">{row}</div>
                        {GRID_CONFIG.cols.map(col => {
                          const pos = `${row}${String(col).padStart(2, '0')}`;
                          const occ = occupancyMap[pos];
                          const isGhost = ghostCells.includes(pos);
                          const isGhostValid = isGhost && selectedVasca && isPositionAvailable(ghostPosition!, selectedVasca.lunghezza, mode === 'move' ? selectedVasca.id : null).available;
                          const isSelected = selectedVasca?.posizione && getOccupiedCells(selectedVasca.posizione, selectedVasca.lunghezza).includes(pos);

                          // Fading Logic
                          const isAnyFilterActive = searchCliente !== '' || searchCommessa !== '' || selectedVasca !== null;
                          let isFaded = false;
                          if (isAnyFilterActive) {
                            if (occ) {
                              const matchesSearch =
                                occ.vasca.cliente.toLowerCase().includes(searchCliente.toLowerCase()) &&
                                occ.vasca.commessa.toLowerCase().includes(searchCommessa.toLowerCase());
                              const matchesSelection = selectedVasca ? occ.vasca.id === selectedVasca.id : true;
                              if (!(matchesSearch && matchesSelection)) isFaded = true;
                            } else {
                              isFaded = true;
                            }
                          }

                          return (
                            <div
                              key={pos}
                              className={`grid-cell ${occ ? 'occupied' : ''} ${isGhost ? (isGhostValid ? 'ghost' : 'ghost invalid') : ''} ${isSelected ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                              style={occ ? { backgroundColor: occ.vasca.colore } : {}}
                              onClick={() => {
                                if (!occ) {
                                  if (mode === 'position') handlePositionVasca(pos);
                                  else if (mode === 'move') handleMoveVasca(pos);
                                } else if (occ && mode === 'view') {
                                  setSelectedVasca(occ.vasca);
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (mode !== 'view') {
                                  selectedVasca && setGhostPosition(pos);
                                } else if (occ) {
                                  setHoveredVasca(occ.vasca);
                                  setMousePos({ x: e.clientX, y: e.clientY });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (occ && mode === 'view') setMousePos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => {
                                setGhostPosition(null);
                                setHoveredVasca(null);
                              }}
                            >
                              {occ?.isFirst && <div className="cell-label">{occ.vasca.codice}</div>}
                              {!occ && !isGhost && <div style={{ fontSize: '9px', color: '#cbd5e1' }}>{pos}</div>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sidebar">
                  <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                    Inventario Vasche <span style={{ color: '#94a3b8' }}>{filteredVasche.length}</span>
                  </h2>
                  <div className="vasca-list">
                    {filteredVasche.map(v => (
                      <div key={v.id} className={`vasca-card ${selectedVasca?.id === v.id ? 'selected' : ''}`} onClick={() => setSelectedVasca(v)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: v.colore }}></div>
                            <span className="vasca-codice">{v.codice}</span>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: v.stato === 'IN_AREA' ? '#10b981' : v.stato === 'CREATA' ? '#f59e0b' : '#ef4444' }}>
                            {v.stato}
                          </span>
                        </div>
                        <div className="vasca-info">
                          <div><strong>Cliente:</strong> {v.cliente}</div>
                          <div><strong>Commessa:</strong> {v.commessa}</div>
                          <div><strong>Lunghezza:</strong> {v.lunghezza}m</div>
                          {v.posizione && <div><strong>Posizione:</strong> {v.posizione}</div>}
                        </div>
                        {selectedVasca?.id === v.id && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                            {v.stato === 'CREATA' && (
                              <button className="btn btn-success" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); setMode('position'); }}>
                                <Check size={14} /> Posiziona
                              </button>
                            )}
                            {v.stato === 'IN_AREA' && (
                              <>
                                <button className="btn btn-warning" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); setMode('move'); }}>
                                  <Move size={14} /> Sposta
                                </button>
                                <button className="btn btn-danger" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); handleScaricaVasca(v); }}>
                                  <Trash2 size={14} /> Scarica
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'logs' ? (
            <div className="grid-section" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px' }}>Storico Operazioni</h2>
                <button className="btn btn-secondary" onClick={clearLog}>
                  Svuota Log
                </button>
              </div>
              <table className="log-table">
                <thead>
                  <tr>
                    <th onClick={() => requestSort('timestamp')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> Data e Ora
                        {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => requestSort('tipo')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Operazione
                        {sortConfig.key === 'tipo' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => requestSort('vascaCodice')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Hash size={14} /> Vasca
                        {sortConfig.key === 'vascaCodice' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => requestSort('utenteNome')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={14} /> Operatore
                        {sortConfig.key === 'utenteNome' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => requestSort('dettagli')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Dettagli evento
                        {sortConfig.key === 'dettagli' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRegistro.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Nessuna attività registrata</td></tr>
                  ) : (
                    sortedRegistro.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleDateString()} <span style={{ opacity: 0.5 }}>-</span> {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td><span className={`log-type ${log.tipo.toLowerCase()}`}>{log.tipo}</span></td>
                        <td style={{ fontWeight: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: log.vascaColore }}></div>{log.vascaCodice}</div></td>
                        <td className="log-operator"><User size={12} /> {log.utenteNome || '---'}</td>
                        <td style={{ color: '#475569' }}>{log.dettagli}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid-section" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Utenti registrati</h2>
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Ruolo</th>
                        <th style={{ textAlign: 'right' }}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utenti.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 700 }}>{u.username}</td>
                          <td style={{ color: '#94a3b8', fontSize: '12px' }}>{u.password || '******'}</td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', background: u.ruolo === 'ADMIN' ? '#dbeafe' : '#f1f5f9', color: u.ruolo === 'ADMIN' ? '#1e40af' : '#64748b' }}>
                              {u.ruolo}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {u.username !== 'admin' && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '6px', borderRadius: '6px', marginLeft: 'auto' }}
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="sidebar" style={{ width: '350px' }}>
                  <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>Aggiungi nuovo utente</h2>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      className="form-input"
                      value={userFormData.username}
                      onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                      placeholder="es. mario.rossi"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="text"
                      className="form-input"
                      value={userFormData.password}
                      onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                      placeholder="Password segreta"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ruolo</label>
                    <select
                      className="form-input"
                      value={userFormData.ruolo}
                      onChange={e => setUserFormData({ ...userFormData, ruolo: e.target.value as 'ADMIN' | 'OPERATORE' })}
                    >
                      <option value="OPERATORE">Operatore</option>
                      <option value="ADMIN">Amministratore</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleCreateUser}>
                    <Plus size={18} /> Crea Utente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODALS */}
          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><Plus color="#3b82f6" /> Nuova Vasca</h2>
                <div className="form-group">
                  <label className="form-label">Codice Identificativo</label>
                  <input className="form-input" value={formData.codice} onChange={e => setFormData({ ...formData, codice: e.target.value })} placeholder="Es. VSC_001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <input className="form-input" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} placeholder="Ragione sociale" />
                </div>
                <div className="form-group">
                  <label className="form-label">Codice Commessa</label>
                  <input className="form-input" value={formData.commessa} onChange={e => setFormData({ ...formData, commessa: e.target.value })} placeholder="COM_XXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lunghezza Totale (metri)</label>
                  <input type="number" className="form-input" value={formData.lunghezza} onChange={e => setFormData({ ...formData, lunghezza: e.target.value })} placeholder="Es. 8.5" />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Annulla</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateVasca}>Crea Vasca</button>
                </div>
              </div>
            </div>
          )}

          {showConfirmModal && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: '420px' }}>
                <h2 style={{ fontSize: '20px' }}>Richiesta Conferma</h2>
                <p style={{ margin: '16px 0 32px', color: '#475569', lineHeight: 1.5 }}>{showConfirmModal.message}</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmModal(null)}><X size={16} /> No</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={showConfirmModal.onConfirm}><Check size={16} /> Sì, procedi</button>
                </div>
              </div>
            </div>
          )}

          {hoveredVasca && <DetailTooltip vasca={hoveredVasca} pos={mousePos} />}
        </>
      )}
    </div>
  );
};

export default LogiTrackVasche;