import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Trash2, Move, Package, AlertCircle, Check, X, Calendar, Clock, User, Hash, ChevronUp, ChevronDown } from 'lucide-react';

const uuidv4 = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * TYPES & INTERFACES
 */
interface Articolo {
  id: string;
  codice: string;
  cliente: string;
  commessa: string;
  lunghezza: number;
  posizione: string | null;
  fila: string | null;
  offsetInizio: number | null;
  tipo: 'VASCA' | 'POZZETTO' | 'SOLETTA';
  livello: number;
  dimBase?: number;
  colore: string;
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
  dataCreazione: string;
}

interface AppUser {
  id: string;
  username: string;
  password?: string;
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
  verticalRows?: string[];
  totalLength: number; // Lunghezza totale della fila in metri
  rowLengths?: Record<string, number>; // Lunghezza specifica per fila in metri
  pixelsPerMeter: number; // Fattore di scala per la visualizzazione
}

interface SolettaRelocationFlow {
  target: Articolo;
  blockers: Articolo[];
  currentIndex: number;
  finalAction: 'ship' | 'move';
  destinationPile?: string;
}

/**
 * CONSTANTS
 */
const SOLETTA_PILES = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
const SOLETTA_MAX_LEVELS = 10;
const SOLETTA_LEVEL_HEIGHT_PX = 20;

const GRID_CONFIGS: Record<'VASCA' | 'POZZETTO' | 'SOLETTA', GridConfig> = {
  VASCA: {
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M'],
    totalLength: 63.38,
    rowLengths: {
      A: 63.38,
      B: 63.38,
      C: 63.38,
      D: 63.38,
      E: 37.22,
      F: 37.22,
      G: 37.22,
      H: 37.22,
      I: 37.22,
      L: 48.78,
      M: 48.78
    },
    pixelsPerMeter: 8
  },
  POZZETTO: {
    rows: ['Frontale', 'Posteriore'],
    totalLength: 10,
    pixelsPerMeter: 60
  },
  SOLETTA: {
    rows: SOLETTA_PILES,
    totalLength: 10,
    pixelsPerMeter: 100
  }
};

const TANK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

/**
 * UI SUB-COMPONENTS
 */

const StatCard = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="stat-card" style={color ? { borderLeftColor: color } : {}}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);

const DetailTooltip = ({ vasca, pos }: { vasca: Articolo, pos: { x: number, y: number } }) => (
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
      <span className="tooltip-value">{vasca.posizione || 'Non posizionato'}</span>
    </div>
    {vasca.tipo === 'POZZETTO' && vasca.dimBase && (
      <div className="tooltip-row">
        <span className="tooltip-label">Base:</span>
        <span className="tooltip-value">{vasca.dimBase}x{vasca.dimBase}</span>
      </div>
    )}
    {(vasca.tipo === 'POZZETTO' || vasca.tipo === 'SOLETTA') && (
      <div className="tooltip-row">
        <span className="tooltip-label">Livello:</span>
        <span className="tooltip-value">{vasca.livello}</span>
      </div>
    )}
  </div>
);

/**
 * MAIN COMPONENT
 */
const LogiTrackVasche = () => {
  // --- States ---
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [currentCategory, setCurrentCategory] = useState<'VASCA' | 'POZZETTO' | 'SOLETTA'>('VASCA');

  const currentGridConfig = useMemo(() => GRID_CONFIGS[currentCategory], [currentCategory]);
  const [registro, setRegistro] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'logs' | 'utenti'>('grid');
  const [utenti, setUtenti] = useState<AppUser[]>([]);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', ruolo: 'OPERATORE' as 'ADMIN' | 'OPERATORE' });
  const [searchCliente, setSearchCliente] = useState('');
  const [searchCommessa, setSearchCommessa] = useState('');
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);
  const [showCommessaSuggestions, setShowCommessaSuggestions] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'in_area' | 'creata' | 'spedite'>('all');
  const [selectedArticolo, setSelectedArticolo] = useState<Articolo | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [mode, setMode] = useState<'view' | 'position' | 'move'>('view');
  const [ghostPosition, setGhostPosition] = useState<string | null>(null);
  const [hoveredArticolo, setHoveredArticolo] = useState<Articolo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({ codice: '', cliente: '', commessa: '', lunghezza: '', dimBase: '' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof LogEntry | 'vascaCodice'; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [solettaRelocationFlow, setSolettaRelocationFlow] = useState<SolettaRelocationFlow | null>(null);
  const normalizeTipo = useCallback((tipo: string): Articolo['tipo'] => {
    if (tipo === 'COPERCHIO') return 'SOLETTA';
    return tipo as Articolo['tipo'];
  }, []);
  const normalizeSolettaStacks = useCallback((items: Articolo[]) => {
    const normalized = [...items];
    const byPile: Record<string, Articolo[]> = {};

    normalized.forEach(item => {
      if (item.tipo !== 'SOLETTA' || item.stato !== 'IN_AREA' || !item.fila) return;
      if (!byPile[item.fila]) byPile[item.fila] = [];
      byPile[item.fila].push(item);
    });

    Object.entries(byPile).forEach(([pile, stack]) => {
      stack
        .sort((a, b) => {
          if (a.livello !== b.livello) return a.livello - b.livello;
          return (a.dataCreazione || '').localeCompare(b.dataCreazione || '');
        })
        .forEach((item, index) => {
          const targetLevel = index + 1;
          if (item.livello !== targetLevel || item.offsetInizio !== 0 || item.posizione !== `${pile} @ Pila (L${targetLevel})`) {
            const idx = normalized.findIndex(n => n.id === item.id);
            if (idx !== -1) {
              normalized[idx] = {
                ...normalized[idx],
                livello: targetLevel,
                offsetInizio: 0,
                posizione: `${pile} @ Pila (L${targetLevel})`
              };
            }
          }
        });
    });

    return normalized;
  }, []);
  const getFilaLength = useCallback((fila: string) => {
    return currentGridConfig.rowLengths?.[fila] ?? currentGridConfig.totalLength;
  }, [currentGridConfig]);
  const maxGridLength = useMemo(() => {
    const lengths = Object.values(currentGridConfig.rowLengths || {});
    return lengths.length > 0 ? Math.max(...lengths) : currentGridConfig.totalLength;
  }, [currentGridConfig]);
  const rulerStep = useMemo(() => {
    if (maxGridLength > 30) return 5;
    if (maxGridLength > 10) return 2;
    return 1;
  }, [maxGridLength]);
  const isScaledVascaLayout = currentCategory === 'VASCA' && !!currentGridConfig.rowLengths;
  const computeOffsetFromPointer = useCallback((fila: string, x: number, rectWidth: number) => {
    if (currentCategory === 'POZZETTO') {
      let offset = Math.ceil(x / currentGridConfig.pixelsPerMeter);
      if (offset < 1) offset = 1;
      if (offset > 10) offset = 10;
      return offset;
    }
    if (currentCategory === 'SOLETTA') return 0;
    if (isScaledVascaLayout) {
      const filaLength = getFilaLength(fila);
      return (x / rectWidth) * filaLength;
    }
    return x / currentGridConfig.pixelsPerMeter;
  }, [currentCategory, currentGridConfig.pixelsPerMeter, getFilaLength, isScaledVascaLayout]);

  // --- Persistence (API) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resVasche, resRegistro] = await Promise.all([
          fetch('http://127.0.0.1:3001/api/articoli'),
          fetch('http://127.0.0.1:3001/api/registro')
        ]);
        const dataVasche = await resVasche.json();
        const dataRegistro = await resRegistro.json();
        const mappedVasche: Articolo[] = dataVasche.map((v: any) => ({ ...v, tipo: normalizeTipo(v.tipo) }));
        const normalizedVasche = normalizeSolettaStacks(mappedVasche);
        setArticoli(normalizedVasche);

        const relevelUpdates = normalizedVasche.filter((v, i) => {
          const original = mappedVasche[i];
          return original && (
            original.livello !== v.livello ||
            original.offsetInizio !== v.offsetInizio ||
            original.posizione !== v.posizione
          );
        });

        if (relevelUpdates.length > 0) {
          Promise.all(relevelUpdates.map(v =>
            fetch(`http://127.0.0.1:3001/api/articoli/${v.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ livello: v.livello, offsetInizio: v.offsetInizio, posizione: v.posizione })
            }).catch(() => null)
          ));
        }
        setRegistro(dataRegistro);
      } catch (err) {
        console.error('Errore nel caricamento dati dal backend:', err);
      }
    };
    if (currentUser) {
      fetchData();
      if (currentUser.ruolo === 'ADMIN') fetchUtenti();
    }
  }, [currentUser, normalizeTipo, normalizeSolettaStacks]);

  const fetchUtenti = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/utenti');
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
      const res = await fetch('http://127.0.0.1:3001/api/utenti', {
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
      const res = await fetch(`http://127.0.0.1:3001/api/utenti/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUtenti();
    } catch (err) {
      console.error('Errore eliminazione utente:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('http://127.0.0.1:3001/api/login', {
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
    const currentColors = articoli.map(v => v.colore);
    for (const color of TANK_COLORS) {
      if (!currentColors.includes(color)) {
        return color;
      }
    }
    return TANK_COLORS[Math.floor(Math.random() * TANK_COLORS.length)];
  }, [articoli]);

  // --- Logging ---
  const addLog = useCallback(async (tipo: LogEntry['tipo'], vasca: Articolo, dettagli: string) => {
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
      await fetch('http://127.0.0.1:3001/api/registro', {
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
  const isPositionAvailable = useCallback((fila: string, offset: number, lunghezza: number, excludeId: string | null = null, tipo: Articolo['tipo'] = 'VASCA') => {
    if (tipo === 'SOLETTA') {
      if (offset !== 0) {
        return { available: false, reason: 'Le solette possono essere posizionate solo in pila' };
      }
    } else if (tipo !== 'POZZETTO') {
      const filaLength = getFilaLength(fila);
      if (offset < 0 || offset + lunghezza > filaLength) {
        return { available: false, reason: 'Spazio insufficiente nella fila' };
      }
    } else {
      // Per POZZETTO, offset deve essere un intero tra 1 e 10
      if (offset < 1 || offset > 10) {
        return { available: false, reason: 'Posizione non valida (deve essere 1-10)' };
      }
    }

    let topLevel = 0;
    let solettaCountInPile = 0;
    const isStackable = tipo === 'POZZETTO' || tipo === 'SOLETTA';

    for (const v of articoli) {
      if (v.id === excludeId || v.stato !== 'IN_AREA' || v.fila !== fila || v.offsetInizio === null) continue;

      if (tipo === 'SOLETTA' && v.tipo === 'SOLETTA') {
        solettaCountInPile += 1;
        continue;
      }

      if (tipo === 'POZZETTO' && v.tipo === 'POZZETTO') {
        if (Math.abs(v.offsetInizio - offset) < 0.1) {
          topLevel = Math.max(topLevel, v.livello);
        }
        continue;
      }

      const start1 = offset;
      const end1 = offset + lunghezza;
      const start2 = v.offsetInizio;
      const end2 = v.offsetInizio + v.lunghezza;

      // Se coincidono esattamente (tolleranza 0.1m)
      const exactMatch = Math.abs(start1 - start2) < 0.1 && Math.abs(lunghezza - v.lunghezza) < 0.1;
      const solettaStack = tipo === 'SOLETTA' && v.tipo === 'SOLETTA' && Math.abs(start1 - start2) < 0.1;

      if ((exactMatch || solettaStack) && isStackable) {
        topLevel = Math.max(topLevel, v.livello);
        continue;
      }

      // Altrimenti controlla sovrapposizione standard
      if (start1 < end2 && end1 > start2) {
        return { available: false, reason: `Sovrapposizione con ${v.tipo.toLowerCase()} ${v.codice}` };
      }
    }

    if (tipo === 'POZZETTO' && topLevel >= 4) {
      return { available: false, reason: 'Altezza massima raggiunta (4 livelli)' };
    }
    if (tipo === 'SOLETTA' && solettaCountInPile >= SOLETTA_MAX_LEVELS) {
      return { available: false, reason: `Pila piena: massimo ${SOLETTA_MAX_LEVELS} solette` };
    }
    if (tipo === 'SOLETTA') {
      return { available: true, nextLevel: solettaCountInPile + 1 };
    }

    return { available: true, nextLevel: topLevel + 1 };
  }, [articoli, currentGridConfig, getFilaLength]);

  // --- Computed Data ---
  const filteredVasche = useMemo(() => {
    return articoli.filter(v => {
      const matchCategory = v.tipo === currentCategory;
      const matchCliente = v.cliente.toLowerCase().includes(searchCliente.toLowerCase());
      const matchCommessa = v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());

      // La ricerca deve essere effettuata esclusivamente tra gli articoli in giacenza (IN_AREA)
      const isSearching = searchCliente !== '' || searchCommessa !== '';
      if (isSearching && v.stato !== 'IN_AREA') return false;

      const matchType =
        filterType === 'all' ||
        (filterType === 'in_area' && v.stato === 'IN_AREA') ||
        (filterType === 'creata' && v.stato === 'CREATA') ||
        (filterType === 'spedite' && v.stato === 'SPEDITA');
      return matchCategory && matchCliente && matchCommessa && matchType;
    });
  }, [articoli, searchCliente, searchCommessa, filterType, currentCategory]);

  const clienteSuggestions = useMemo(() => {
    if (!searchCliente) return [];
    return Array.from(new Set(
      articoli.filter(v => v.stato === 'IN_AREA')
        .map(v => v.cliente)
        .filter(c => c.toLowerCase().includes(searchCliente.toLowerCase()) && c.toLowerCase() !== searchCliente.toLowerCase())
    )).slice(0, 5);
  }, [articoli, searchCliente]);

  const commessaSuggestions = useMemo(() => {
    if (!searchCommessa) return [];
    return Array.from(new Set(
      articoli.filter(v => v.stato === 'IN_AREA')
        .map(v => v.commessa)
        .filter(c => c.toLowerCase().includes(searchCommessa.toLowerCase()) && c.toLowerCase() !== searchCommessa.toLowerCase())
    )).slice(0, 5);
  }, [articoli, searchCommessa]);

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

  const articoliPerFila = useMemo(() => {
    const map: Record<string, Articolo[]> = {};
    currentGridConfig.rows.forEach(r => map[r] = []);
    if (currentGridConfig.verticalRows) {
      currentGridConfig.verticalRows.forEach(r => map[r] = []);
    }
    articoli.filter(v => v.tipo === currentCategory && v.stato === 'IN_AREA' && v.fila).forEach(v => {
      if (v.fila && map[v.fila]) {
        map[v.fila].push(v);
      }
    });
    return map;
  }, [articoli, currentGridConfig, currentCategory]);

  const ghostData = useMemo(() => {
    if (!ghostPosition || !selectedArticolo) return null;
    const parts = ghostPosition.split(':');
    const fila = parts[0];
    const offset = parseFloat(parts[1]);
    const check = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, selectedArticolo.id, selectedArticolo.tipo);
    return {
      fila,
      offset,
      isValid: check.available,
      nextLevel: (check as any).nextLevel || 1
    };
  }, [ghostPosition, selectedArticolo, isPositionAvailable]);

  // --- Handlers ---
  const handleCreateArticolo = async () => {
    const { codice, cliente, commessa, lunghezza } = formData;
    if (!codice || !cliente || !commessa || !lunghezza) {
      alert('Tutti i campi sono obbligatori');
      return;
    }

    // Check for duplicate code locally
    const isDuplicate = articoli.some(v => v.codice.trim().toUpperCase() === codice.trim().toUpperCase());
    if (isDuplicate) {
      alert(`Il codice articolo '${codice}' esiste già.`);
      return;
    }

    const normalizedLunghezza = lunghezza.toString().replace(',', '.');
    const numLunghezza = Number(normalizedLunghezza);
    if (isNaN(numLunghezza) || numLunghezza <= 0) {
      alert('La lunghezza deve essere un numero valido maggiore di zero');
      return;
    }

    try {
      const newArticolo: Articolo = {
        id: uuidv4(),
        codice,
        cliente,
        commessa,
        lunghezza: numLunghezza,
        posizione: null,
        fila: null,
        offsetInizio: null,
        tipo: currentCategory,
        livello: 1,
        stato: 'CREATA',
        colore: getNextColor(),
        dataCreazione: new Date().toISOString()
      };

      const res = await fetch('http://127.0.0.1:3001/api/articoli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newArticolo.id,
          codice: newArticolo.codice,
          cliente: newArticolo.cliente,
          commessa: newArticolo.commessa,
          lunghezza: newArticolo.lunghezza,
          dimBase: formData.dimBase || null,
          colore: newArticolo.colore,
          stato: newArticolo.stato,
          dataCreazione: newArticolo.dataCreazione,
          tipo: newArticolo.tipo,
          livello: newArticolo.livello
        })
      });

      if (res.ok) {
        setArticoli(prev => [...prev, newArticolo]);
        addLog('CREAZIONE', newArticolo, `Creato nuovo ${newArticolo.tipo.toLowerCase()} per cliente ${newArticolo.cliente}`);
        setShowCreateModal(false);
        setFormData({ codice: '', cliente: '', commessa: '', lunghezza: '', dimBase: '' });
      } else {
        let errorMessage = 'Errore nella creazione.';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Failed to create articolo:', errorData);
        } catch (e) {
          console.error('Risposta non JSON dal server');
        }
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Errore nella creazione articolo:', err);
      alert('Errore di rete o del server. Verifica che il backend sia attivo.');
    }
  };

  const applyGravity = async (fila: string, offset: number) => {
    // Ricalcola i livelli per gli articoli rimasti in una pila (Pozzetti/Solette)
    setArticoli(currentArticoli => {
      const pile = currentArticoli
        .filter((v: Articolo) => v.stato === 'IN_AREA' && v.fila === fila && Math.abs((v.offsetInizio || 0) - offset) < 0.1)
        .sort((a: Articolo, b: Articolo) => a.livello - b.livello);

      const updates: Articolo[] = [];
        const newArticoli = currentArticoli.map((v: Articolo) => {
        const indexInPile = pile.findIndex(p => p.id === v.id);
        if (indexInPile !== -1) {
          const expectedLevel = indexInPile + 1;
          if (v.livello !== expectedLevel) {
            const updated = {
              ...v,
              livello: expectedLevel,
              posizione: v.tipo === 'POZZETTO'
                ? `${fila} @ Slot ${offset} (H${expectedLevel})`
                : v.tipo === 'SOLETTA'
                  ? `${fila} @ Pila (L${expectedLevel})`
                  : `${fila} @ ${offset.toFixed(2)}m (L${expectedLevel})`
            };
            updates.push(updated);
            return updated;
          }
        }
        return v;
      });

      // Persistenza asincrona degli aggiornamenti (fuori dal setter per evitare side-effects diretti nel render)
      if (updates.length > 0) {
        setTimeout(async () => {
          for (const up of updates) {
            try {
              await fetch(`http://127.0.0.1:3001/api/articoli/${up.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ livello: up.livello, posizione: up.posizione })
              });
              const posLabel = up.tipo === 'POZZETTO' ? `Slot ${up.offsetInizio}` : `${up.offsetInizio?.toFixed(2)}m`;
              const levelLabel = up.tipo === 'POZZETTO' ? `H${up.livello}` : `L${up.livello}`;
              addLog('MOVIMENTAZIONE', up, `Caduta automatica in ${fila} @ ${posLabel} (${levelLabel})`);
            } catch (err) {
              console.error(`Errore ricalcolo gravità per ${up.codice}:`, err);
            }
          }
        }, 0);
      }

      return newArticoli;
    });
  };

  const moveArticolo = async (
    vascaId: string,
    newFila: string | null,
    newOffset: number | null,
    newState: Articolo['stato'],
    logType: LogEntry['tipo'],
    logDetails: string,
    newLevel: number = 1,
    options?: { preserveUi?: boolean }
  ) => {
    const vasca = articoli.find(v => v.id === vascaId);
    if (!vasca) return false;

    try {
      const res = await fetch(`http://127.0.0.1:3001/api/articoli/${vascaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fila: newFila,
          offsetInizio: newOffset,
          stato: newState,
          livello: newLevel,
          posizione: newFila
            ? (vasca?.tipo === 'POZZETTO'
              ? `${newFila} @ Slot ${newOffset} (H${newLevel})`
              : vasca?.tipo === 'SOLETTA'
                ? `${newFila} @ Pila (L${newLevel})`
                : `${newFila} @ ${newOffset?.toFixed(2)}m (L${newLevel})`)
            : null
        })
      });
      if (res.ok) {
        setArticoli(prev => (prev as Articolo[]).map(v =>
          v.id === vascaId
            ? {
              ...v,
              fila: newFila,
              offsetInizio: newOffset,
              stato: newState,
              livello: newLevel,
              posizione: newFila
                ? (v.tipo === 'POZZETTO'
                  ? `${newFila} @ Slot ${newOffset} (H${newLevel})`
                  : v.tipo === 'SOLETTA'
                    ? `${newFila} @ Pila (L${newLevel})`
                    : `${newFila} @ ${newOffset?.toFixed(2)}m (L${newLevel})`)
                : null
            }
            : v
        ));
        addLog(logType, { ...vasca, fila: newFila, offsetInizio: newOffset, stato: newState }, logDetails);
        if (vasca.fila && vasca.offsetInizio !== null) {
          applyGravity(vasca.fila, vasca.offsetInizio);
        }
        if (vasca.tipo === 'SOLETTA' && newFila) {
          applyGravity(newFila, 0);
        }

        if (!options?.preserveUi) {
          setMode('view');
          setSelectedArticolo(null);
          setGhostPosition(null);
        }
        return true;
      } else {
        console.error('Failed to move vasca:', await res.text());
        alert('Errore nello spostamento della vasca.');
        return false;
      }
    } catch (err) {
      console.error('Errore nello spostamento della vasca:', err);
      alert('Errore di rete o del server.');
      return false;
    }
  };

  const handlePositionArticolo = (fila: string, offset: number) => {
    if (!selectedArticolo || mode !== 'position') return;

    // Per i pozzetti, l'offset passato è già lo slot (1-10)
    const check = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, null, selectedArticolo.tipo);
    if (!check.available) {
      alert(`❌ ${check.reason}`);
      return;
    }
    const nextLevel = (check as any).nextLevel || 1;
    const posLabel = selectedArticolo.tipo === 'POZZETTO'
      ? `Slot ${offset} (H${nextLevel})`
      : selectedArticolo.tipo === 'SOLETTA'
        ? `Pila ${fila} (L${nextLevel})`
        : `${offset.toFixed(2)}m (L${nextLevel})`;

    setShowConfirmModal({
      message: `Posizionare ${selectedArticolo.codice} in Fila ${fila} a ${posLabel}?`,
      onConfirm: () => {
        moveArticolo(selectedArticolo.id, fila, offset, 'IN_AREA', 'ENTRATA', `Posizionata in ${fila} @ ${posLabel}`, nextLevel);
        setShowConfirmModal(null);
      }
    });
  };

  const handleMoveArticolo = (fila: string, offset: number) => {
    if (!selectedArticolo || mode !== 'move') return;
    if (selectedArticolo.tipo === 'SOLETTA') {
      const blockers = getSolettaBlockers(selectedArticolo);
      if (blockers.length > 0) {
        startSolettaRelocationFlow(selectedArticolo, 'move', fila);
        return;
      }
    }
    const check = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, selectedArticolo.id, selectedArticolo.tipo);
    if (!check.available) {
      alert(`❌ ${check.reason}`);
      return;
    }
    const nextLevel = (check as any).nextLevel || 1;
    const posLabel = selectedArticolo.tipo === 'POZZETTO'
      ? `Slot ${offset} (H${nextLevel})`
      : selectedArticolo.tipo === 'SOLETTA'
        ? `Pila ${fila} (L${nextLevel})`
        : `${offset.toFixed(2)}m (L${nextLevel})`;

    setShowConfirmModal({
      message: `Spostare ${selectedArticolo.codice} a Fila ${fila} @ ${posLabel}?`,
      onConfirm: () => {
        moveArticolo(selectedArticolo.id, fila, offset, 'IN_AREA', 'MOVIMENTAZIONE', `Spostata in ${fila} @ ${posLabel}`, nextLevel);
        setShowConfirmModal(null);
      }
    });
  };

  const getSolettaBlockers = (target: Articolo) => {
    return articoli
      .filter(v =>
        v.tipo === 'SOLETTA' &&
        v.stato === 'IN_AREA' &&
        v.id !== target.id &&
        v.fila === target.fila &&
        v.offsetInizio !== null &&
        target.offsetInizio !== null &&
        Math.abs(v.offsetInizio - target.offsetInizio) < 0.1 &&
        v.livello > target.livello
      )
      .sort((a, b) => b.livello - a.livello);
  };

  const startSolettaRelocationFlow = (target: Articolo, finalAction: 'ship' | 'move', destinationPile?: string) => {
    const blockers = getSolettaBlockers(target);

    if (blockers.length === 0) {
      if (finalAction === 'ship') {
        setShowConfirmModal({
          message: `Scaricare ${target.codice}? Le piazzole saranno liberate.`,
          onConfirm: () => {
            executeShipArticolo(target);
            setShowConfirmModal(null);
          }
        });
      }
      return;
    }

    setSolettaRelocationFlow({
      target,
      blockers,
      currentIndex: 0,
      finalAction,
      destinationPile
    });
  };

  const handleSolettaRelocation = async (destinationPile: string) => {
    if (!solettaRelocationFlow) return;
    const current = solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex];
    if (!current) return;

    if (current.fila === destinationPile) {
      alert('Seleziona una pila diversa da quella corrente');
      return;
    }

    const check = isPositionAvailable(destinationPile, 0, current.lunghezza, current.id, 'SOLETTA');
    if (!check.available) {
      alert(`❌ ${check.reason}`);
      return;
    }

    const nextLevel = (check as any).nextLevel || 1;
    const moved = await moveArticolo(
      current.id,
      destinationPile,
      0,
      'IN_AREA',
      'MOVIMENTAZIONE',
      `Riposizionata in pila ${destinationPile} (L${nextLevel})`,
      nextLevel,
      { preserveUi: true }
    );

    if (!moved) return;

    const isLast = solettaRelocationFlow.currentIndex >= solettaRelocationFlow.blockers.length - 1;
    if (isLast) {
      const target = solettaRelocationFlow.target;
      const finalAction = solettaRelocationFlow.finalAction;
      const destinationPile = solettaRelocationFlow.destinationPile;
      setSolettaRelocationFlow(null);
      if (finalAction === 'ship') {
        setShowConfirmModal({
          message: `Riposizionamento completato. Scaricare ${target.codice}?`,
          onConfirm: () => {
            executeShipArticolo(target);
            setShowConfirmModal(null);
          }
        });
      } else if (finalAction === 'move' && destinationPile) {
        const targetNow = articoli.find(v => v.id === target.id) || target;
        const targetCheck = isPositionAvailable(destinationPile, 0, targetNow.lunghezza, targetNow.id, 'SOLETTA');
        if (!targetCheck.available) {
          alert(`❌ ${targetCheck.reason}`);
          return;
        }
        const targetLevel = (targetCheck as any).nextLevel || 1;
        await moveArticolo(
          targetNow.id,
          destinationPile,
          0,
          'IN_AREA',
          'MOVIMENTAZIONE',
          `Spostata in pila ${destinationPile} (L${targetLevel})`,
          targetLevel
        );
      }
      return;
    }

    setSolettaRelocationFlow(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev);
  };

  const executeShipArticolo = async (vasca: Articolo) => {
    // LIFO check for POZZETTO and SOLETTA
    if (vasca.tipo === 'POZZETTO' || vasca.tipo === 'SOLETTA') {
      const itemAbove = articoli.find(v =>
        v.stato === 'IN_AREA' &&
        v.fila === vasca.fila &&
        v.offsetInizio !== null &&
        Math.abs(v.offsetInizio - (vasca.offsetInizio || 0)) < 0.1 &&
        v.livello > vasca.livello
      );
      if (itemAbove) {
        alert(`❌ Errore LIFO: impossibile prelevare. Sopra c'è ${itemAbove.tipo.toLowerCase()} ${itemAbove.codice}.`);
        return;
      }
    }

    try {
      const res = await fetch(`http://127.0.0.1:3001/api/articoli/${vasca.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posizione: null, stato: 'SPEDITA', livello: 0, fila: null, offsetInizio: null })
      });
      if (res.ok) {
        setArticoli(prev => (prev as Articolo[]).map(v =>
          v.id === vasca.id ? { ...v, posizione: null, stato: 'SPEDITA', livello: 0, fila: null, offsetInizio: null } : v
        ));
        addLog('SPEDIZIONE', vasca, 'Articolo spedita correttamente');

        if (vasca.fila && vasca.offsetInizio !== null) {
          applyGravity(vasca.fila, vasca.offsetInizio);
        }

        setSelectedArticolo(null);
      } else {
        console.error('Failed to ship vasca:', await res.text());
        alert('Errore nella spedizione della vasca.');
      }
    } catch (err) {
      console.error('Errore nella spedizione della vasca:', err);
      alert('Errore di rete o del server.');
    }
  };

  const handleScaricaArticolo = (v: Articolo) => {
    if (v.tipo === 'SOLETTA' && v.stato === 'IN_AREA') {
      startSolettaRelocationFlow(v, 'ship');
      return;
    }
    setShowConfirmModal({
      message: `Scaricare ${v.codice}? Le piazzole saranno liberate.`,
      onConfirm: () => {
        executeShipArticolo(v);
        setShowConfirmModal(null);
      }
    });
  };

  const clearLog = async () => {
    if (confirm('Pulire tutto il registro?')) {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/registro', {
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
        
        /* Linear Layout (Timeline) */
        .content { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
        .grid-section { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .grid-container { overflow-x: auto; padding: 10px; }
        
        .fila-row { display: grid; grid-template-columns: 60px 1fr; gap: 12px; align-items: center; margin-bottom: 12px; padding: 8px; background: #f8fafc; border-radius: 12px; }
        .fila-label { font-weight: 800; font-size: 18px; color: #1e293b; text-align: center; }
        
        .fila-track { 
          height: 60px; 
          background: #e2e8f0; 
          border-radius: 8px; 
          position: relative; 
          border: 2px solid #cbd5e1; 
          overflow: hidden;
          cursor: crosshair;
        }
        .fila-track:hover { border-color: #3b82f6; }
        
        .vasca-block {
          position: absolute;
          height: 80%;
          top: 10%;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 8px;
        }
        .vasca-block:hover { transform: translateY(-2px); z-index: 10; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .vasca-block.selected { border: 3px solid #f59e0b; }
        
        .pozzetto-cube { 
          top: auto !important; 
          margin-bottom: 2px;
        }
        
        .ghost-block {
          position: absolute;
          height: 80%;
          top: 10%;
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.3);
          border: 2px dashed #3b82f6;
          pointer-events: none;
        }
        .ghost-block.invalid { background: rgba(239, 68, 68, 0.3); border-color: #ef4444; }
        
        .ruler {
          display: flex;
          justify-content: space-between;
          padding: 0 60px 0 72px;
          margin-bottom: 24px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
        }
        
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
        .product-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .product-tab { padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s; font-size: 13px; color: #64748b; }
        .product-tab:hover { background: #e2e8f0; }
        .product-tab.active { background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .product-tab.active.vasca { color: #3b82f6; }
        .product-tab.active.pozzetto { color: #10b981; }
        .product-tab.active.soletta { color: #f59e0b; }
        
        .faded { opacity: 0.25; filter: grayscale(0.5); }
      `}</style>

      {/* LOGIN OVERLAY - EXCLUSIVE */}
      {!currentUser ? (
        <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 999999, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div style={{ background: '#eff6ff', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Package size={32} color="#3b82f6" />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Benvenuto in LogiTrack</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Accedi per gestire la movimentazione articoli</p>

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
          <header className="header" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Package size={32} color="#3b82f6" />
                <h1 style={{ fontSize: '24px', letterSpacing: '-0.5px', marginBottom: 0 }}>LogiTrack <span style={{ color: '#94a3b8', fontWeight: 400 }}>v2.5</span></h1>
              </div>

              <div className="product-tabs">
                {(['VASCA', 'POZZETTO', 'SOLETTA'] as const).map(cat => (
                  <div
                    key={cat}
                    className={`product-tab ${currentCategory === cat ? 'active' : ''} ${cat.toLowerCase()}`}
                    onClick={() => {
                      setCurrentCategory(cat);
                      setSelectedArticolo(null);
                      setMode('view');
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Yard Manager Multi-Prodotto</p>
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
          </header>

          <div className="stats" style={{ position: 'relative', zIndex: 1 }}>
            <StatCard label={`${currentCategory} Totali`} value={articoli.filter(v => v.tipo === currentCategory).length} />
            <StatCard label="In piazzola" value={articoli.filter(v => v.stato === 'IN_AREA' && v.tipo === currentCategory).length} color="#10b981" />
            <StatCard label="In attesa" value={articoli.filter(v => v.stato === 'CREATA' && v.tipo === currentCategory).length} color="#f59e0b" />
            <StatCard label="Spedite" value={articoli.filter(v => v.stato === 'SPEDITA' && v.tipo === currentCategory).length} color="#ef4444" />
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
              <Plus size={20} /> Nuova Articolo
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
                      Scegli una piazzola libera per la vasca <strong>{selectedArticolo?.codice}</strong> ({selectedArticolo?.lunghezza}m)
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}
                      onClick={() => { setMode('view'); setSelectedArticolo(null); setGhostPosition(null); }}
                    >
                      <X size={14} /> Cancella operazione
                    </button>
                  </div>
                </div>
              )}

              <div className="content" style={{ position: 'relative', zIndex: 1 }}>
                <div className="grid-section">
                  {currentCategory === 'SOLETTA' ? (
                    <div className="ruler" style={{ justifyContent: 'space-between' }}>
                      <span>Pile affiancate: 12</span>
                      <span>Altezza singola soletta: 20 cm</span>
                      <span>Capienza: 10 per pila</span>
                    </div>
                  ) : (
                    <div className="ruler">
                      {Array.from({ length: Math.floor(maxGridLength / rulerStep) + 1 }).map((_, i) => (
                        <span key={i}>{i * rulerStep}m</span>
                      ))}
                    </div>
                  )}

                  <div className="grid-container" onMouseMove={(e: React.MouseEvent) => {
                    if (mode === 'view') return;
                    setMousePos({ x: e.clientX, y: e.clientY });
                  }}>
                    <div className="grid-content-layout" style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', padding: '20px' }}>
                      {/* --- SEZIONE VERTICALE (V1, V2 ecc.) --- */}
                      {currentGridConfig.verticalRows && currentGridConfig.verticalRows.length > 0 && (
                        <div className="vertical-tracks-section" style={{ display: 'flex', gap: '15px' }}>
                          {currentGridConfig.verticalRows.map((fila: string) => (
                            <div key={fila} className="fila-column" style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
                              <div className="fila-label" style={{ marginTop: '10px' }}>{fila}</div>
                              <div
                                className="fila-track-vertical"
                                style={{
                                  width: '60px',
                                  height: currentGridConfig.totalLength * currentGridConfig.pixelsPerMeter,
                                  background: '#f8fafc',
                                  position: 'relative',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}
                                onClick={(e: any) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const y = e.clientY - rect.bottom;
                                  const offset = Math.abs(y) / currentGridConfig.pixelsPerMeter;
                                  if (mode === 'position') handlePositionArticolo(fila, offset);
                                  if (mode === 'move') handleMoveArticolo(fila, offset);
                                }}
                                onMouseMove={(e: any) => {
                                  if (mode === 'view') return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const y = e.clientY - rect.bottom;
                                  const offset = Math.abs(y) / currentGridConfig.pixelsPerMeter;
                                  setGhostPosition(`${fila}:${offset}`);
                                }}
                                onMouseLeave={() => setGhostPosition(null)}
                              >
                                {articoliPerFila[fila]?.map((v: Articolo) => {
                                  const isAnyFilterActive = searchCliente !== '' || searchCommessa !== '' || selectedArticolo !== null;
                                  let isFaded = false;
                                  if (isAnyFilterActive) {
                                    const matchCliente = searchCliente === '' || v.cliente.toLowerCase().includes(searchCliente.toLowerCase());
                                    const matchCommessa = searchCommessa === '' || v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());
                                    const isSelected = selectedArticolo?.id === v.id;
                                    if (!matchCliente || !matchCommessa) isFaded = true;
                                    if (selectedArticolo && !isSelected) isFaded = true;
                                    if (isSelected) isFaded = false;
                                  }

                                  return (
                                    <div
                                      key={v.id}
                                      className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                                      style={{
                                        left: 2,
                                        bottom: (v.offsetInizio || 0) * currentGridConfig.pixelsPerMeter,
                                        width: '54px',
                                        height: v.lunghezza * currentGridConfig.pixelsPerMeter,
                                        backgroundColor: v.colore,
                                        opacity: isFaded ? 0.35 : 1,
                                        zIndex: selectedArticolo?.id === v.id ? 20 : 10
                                      }}
                                      onClick={(e: any) => { e.stopPropagation(); setSelectedArticolo(v); }}
                                    >
                                      <div className="vasca-code" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                                        {v.codice}
                                      </div>
                                    </div>
                                  );
                                })}

                                {ghostData?.fila === fila && (
                                  <div
                                    className={`ghost-block ${ghostData.isValid ? 'valid' : 'invalid'}`}
                                    style={{
                                      left: 2,
                                      bottom: ghostData.offset * currentGridConfig.pixelsPerMeter,
                                      width: '54px',
                                      height: selectedArticolo!.lunghezza * currentGridConfig.pixelsPerMeter,
                                      zIndex: 30
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* --- SEZIONE ORIZZONTALE / SOLETTE --- */}
                      <div className="horizontal-tracks-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {currentCategory === 'SOLETTA' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(84px, 1fr))', gap: '10px', alignItems: 'end' }}>
                            {SOLETTA_PILES.map((pile, index) => {
                              const pileItems = [...(articoliPerFila[pile] || [])].sort((a, b) => a.livello - b.livello);
                              const occupiedLevels = pileItems.length;
                              return (
                                <div key={pile} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{index + 1}</div>
                                  <div
                                    className="fila-track"
                                    style={{
                                      width: '100%',
                                      height: `${SOLETTA_MAX_LEVELS * SOLETTA_LEVEL_HEIGHT_PX + 4}px`,
                                      background: '#f8fafc',
                                      position: 'relative'
                                    }}
                                    onClick={() => {
                                      if (mode === 'position') handlePositionArticolo(pile, 0);
                                      if (mode === 'move') handleMoveArticolo(pile, 0);
                                    }}
                                    onMouseMove={() => {
                                      if (mode === 'view') return;
                                      setGhostPosition(`${pile}:0`);
                                    }}
                                    onMouseLeave={() => setGhostPosition(null)}
                                  >
                                    {Array.from({ length: SOLETTA_MAX_LEVELS + 1 }).map((_, i) => (
                                      <div
                                        key={`${pile}-lv-${i}`}
                                        style={{
                                          position: 'absolute',
                                          bottom: i * SOLETTA_LEVEL_HEIGHT_PX,
                                          width: '100%',
                                          borderTop: '1px dashed #dbe3ef',
                                          pointerEvents: 'none'
                                        }}
                                      />
                                    ))}

                                    {pileItems.map((v: Articolo) => {
                                      const isAnyFilterActive = searchCliente !== '' || searchCommessa !== '' || selectedArticolo !== null;
                                      let isFaded = false;
                                      if (isAnyFilterActive) {
                                        const matchesSearch =
                                          v.cliente.toLowerCase().includes(searchCliente.toLowerCase()) &&
                                          v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());
                                        const matchesSelection = selectedArticolo ? v.id === selectedArticolo.id : true;
                                        if (!(matchesSearch && matchesSelection)) isFaded = true;
                                      }

                                      return (
                                        <div
                                          key={v.id}
                                          className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                                          style={{
                                            left: '3px',
                                            top: 'auto',
                                            width: 'calc(100% - 6px)',
                                            height: `${SOLETTA_LEVEL_HEIGHT_PX - 2}px`,
                                            bottom: `${(v.livello - 1) * SOLETTA_LEVEL_HEIGHT_PX + 1}px`,
                                            backgroundColor: v.colore,
                                            opacity: isFaded ? 0.35 : 1,
                                            zIndex: 10 + (v.livello || 1),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            color: '#fff'
                                          }}
                                          onClick={(e: any) => {
                                            e.stopPropagation();
                                            setSelectedArticolo(v);
                                          }}
                                          onMouseEnter={() => setHoveredArticolo(v)}
                                          onMouseLeave={() => setHoveredArticolo(null)}
                                        >
                                          {v.codice.slice(-6)}
                                        </div>
                                      );
                                    })}

                                    {ghostData && ghostData.fila === pile && (
                                      <div
                                        className={`ghost-block ${!ghostData.isValid ? 'invalid' : ''}`}
                                        style={{
                                          left: '3px',
                                          top: 'auto',
                                          width: 'calc(100% - 6px)',
                                          height: `${SOLETTA_LEVEL_HEIGHT_PX - 2}px`,
                                          bottom: `${((ghostData.nextLevel || 1) - 1) * SOLETTA_LEVEL_HEIGHT_PX + 1}px`
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>{occupiedLevels}/{SOLETTA_MAX_LEVELS}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {currentGridConfig.rows.map((fila: string) => {
                              const filaLength = getFilaLength(fila);
                              return (
                                <div key={fila} className="fila-row">
                                  <div className="fila-label">{fila}</div>
                                  <div
                                    className="fila-track"
                                    style={{
                                      width: isScaledVascaLayout
                                        ? `${(filaLength / maxGridLength) * 100}%`
                                        : getFilaLength(fila) * currentGridConfig.pixelsPerMeter,
                                      height: currentCategory === 'POZZETTO' ? '160px' : '60px',
                                      background: currentCategory === 'POZZETTO' ? 'transparent' : '#f8fafc',
                                      position: 'relative'
                                    }}
                                    onClick={(e: any) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - rect.left;
                                      const offset = computeOffsetFromPointer(fila, x, rect.width);
                                      if (mode === 'position') handlePositionArticolo(fila, offset);
                                      if (mode === 'move') handleMoveArticolo(fila, offset);
                                    }}
                                    onMouseMove={(e: any) => {
                                      if (mode === 'view') return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - rect.left;
                                      const offset = computeOffsetFromPointer(fila, x, rect.width);
                                      setGhostPosition(`${fila}:${offset}`);
                                    }}
                                    onMouseLeave={() => setGhostPosition(null)}
                                  >
                                    {currentCategory === 'POZZETTO' && (
                                      <>
                                        {Array.from({ length: 11 }).map((_, i) => (
                                          <div key={`v-${i}`} style={{
                                            position: 'absolute',
                                            left: i * currentGridConfig.pixelsPerMeter,
                                            width: 0,
                                            height: '100%',
                                            borderRight: '1px dashed #cbd5e1',
                                            pointerEvents: 'none',
                                            zIndex: 0
                                          }} />
                                        ))}
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <div key={`h-${i}`} style={{
                                            position: 'absolute',
                                            bottom: i * 40,
                                            width: '100%',
                                            height: 0,
                                            borderTop: '1px dashed #cbd5e1',
                                            pointerEvents: 'none',
                                            zIndex: 0
                                          }} />
                                        ))}
                                      </>
                                    )}
                                    {articoliPerFila[fila]?.map((v: Articolo) => {
                                      const isAnyFilterActive = searchCliente !== '' || searchCommessa !== '' || selectedArticolo !== null;
                                      let isFaded = false;
                                      if (isAnyFilterActive) {
                                        const matchesSearch =
                                          v.cliente.toLowerCase().includes(searchCliente.toLowerCase()) &&
                                          v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());
                                        const matchesSelection = selectedArticolo ? v.id === selectedArticolo.id : true;
                                        if (!(matchesSearch && matchesSelection)) isFaded = true;
                                      }

                                      if (v.tipo === 'POZZETTO') {
                                        return (
                                          <div
                                            key={v.id}
                                            className={`vasca-block pozzetto-cube ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                                            style={{
                                              left: ((v.offsetInizio || 1) - 1) * currentGridConfig.pixelsPerMeter + 2,
                                              bottom: (v.livello - 1) * 40,
                                              width: currentGridConfig.pixelsPerMeter - 4,
                                              height: 36,
                                              backgroundColor: v.colore,
                                              opacity: isFaded ? 0.35 : 1,
                                              zIndex: 10 + (v.livello || 1),
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '11px',
                                              fontWeight: 800,
                                              color: '#fff',
                                              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                                              borderRadius: '4px',
                                              transition: 'all 0.2s ease'
                                            }}
                                            onClick={(e: any) => {
                                              e.stopPropagation();
                                              setSelectedArticolo(v);
                                            }}
                                            onMouseEnter={() => setHoveredArticolo(v)}
                                            onMouseLeave={() => setHoveredArticolo(null)}
                                          >
                                            {v.codice.slice(-4)}
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={v.id}
                                          className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                                          style={{
                                            left: isScaledVascaLayout ? `${(((v.offsetInizio || 0) / filaLength) * 100)}%` : (v.offsetInizio || 0) * currentGridConfig.pixelsPerMeter,
                                            width: isScaledVascaLayout ? `${((v.lunghezza / filaLength) * 100)}%` : v.lunghezza * currentGridConfig.pixelsPerMeter,
                                            backgroundColor: v.colore,
                                            opacity: isFaded ? 0.35 : 1,
                                            transform: v.livello > 1 ? `translateY(-${(v.livello - 1) * 10}px)` : 'none',
                                            zIndex: 10 + (v.livello || 1)
                                          }}
                                          onClick={(e: any) => {
                                            e.stopPropagation();
                                            setSelectedArticolo(v);
                                          }}
                                          onMouseEnter={() => setHoveredArticolo(v)}
                                          onMouseLeave={() => setHoveredArticolo(null)}
                                        >
                                          {v.codice} {v.livello > 1 && `(L${v.livello})`}
                                        </div>
                                      );
                                    })}

                                    {ghostData && ghostData.fila === fila && (
                                      <div
                                        className={`ghost-block ${!ghostData.isValid ? 'invalid' : ''}`}
                                        style={{
                                          left: currentCategory === 'POZZETTO'
                                            ? (ghostData.offset - 1) * currentGridConfig.pixelsPerMeter
                                            : isScaledVascaLayout
                                              ? `${((ghostData.offset / filaLength) * 100)}%`
                                              : ghostData.offset * currentGridConfig.pixelsPerMeter,
                                          width: currentCategory === 'POZZETTO'
                                            ? currentGridConfig.pixelsPerMeter
                                            : isScaledVascaLayout
                                              ? `${((selectedArticolo!.lunghezza / filaLength) * 100)}%`
                                              : selectedArticolo!.lunghezza * currentGridConfig.pixelsPerMeter,
                                          height: currentCategory === 'POZZETTO' ? 40 : '100%',
                                          bottom: currentCategory === 'POZZETTO'
                                            ? (ghostData.nextLevel - 1) * 40
                                            : 0,
                                          top: currentCategory === 'POZZETTO' ? 'auto' : currentCategory === 'VASCA' ? '10%' : 'auto'
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sidebar">
                  <h2 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                    Inventario Vasche <span style={{ color: '#94a3b8' }}>{filteredVasche.length}</span>
                  </h2>
                  <div className="vasca-list">
                    {filteredVasche.map(v => (
                      <div key={v.id} className={`vasca-card ${selectedArticolo?.id === v.id ? 'selected' : ''}`} onClick={() => setSelectedArticolo(v)}>
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
                        {selectedArticolo?.id === v.id && (
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
                                <button className="btn btn-danger" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); handleScaricaArticolo(v); }}>
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
                        <Hash size={14} /> Articolo
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
                    sortedRegistro.map((log: LogEntry) => (
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
                      {utenti.map((u: AppUser) => (
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
                <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}><Plus color="#3b82f6" /> Nuovo {currentCategory.toLowerCase()}</h2>
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

                {currentCategory === 'POZZETTO' ? (
                  <div className="form-group">
                    <label className="form-label">Dimensione Base (cm)</label>
                    <select
                      className="form-input"
                      value={formData.dimBase}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          dimBase: val,
                          lunghezza: val ? (Number(val) / 100).toString() : ''
                        });
                      }}
                    >
                      <option value="">Seleziona base...</option>
                      <option value="80">80x80</option>
                      <option value="120">120x120</option>
                      <option value="160">160x160</option>
                      <option value="200">200x200</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Lunghezza Totale (metri)</label>
                    <input type="number" className="form-input" value={formData.lunghezza} onChange={e => setFormData({ ...formData, lunghezza: e.target.value })} placeholder="Es. 8.5" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Annulla</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateArticolo}>Crea Articolo</button>
                </div>
              </div>
            </div>
          )}

          {solettaRelocationFlow && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: '720px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Riposizionamento Solette</h2>
                <p style={{ marginBottom: '8px', color: '#475569', lineHeight: 1.5 }}>
                  Per scaricare <strong>{solettaRelocationFlow.target.codice}</strong>, riposiziona le solette sovrapposte una alla volta.
                </p>
                <p style={{ marginBottom: '20px', color: '#64748b' }}>
                  Passo {solettaRelocationFlow.currentIndex + 1} di {solettaRelocationFlow.blockers.length}
                </p>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                    Soletta da spostare: {solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.codice}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Pila attuale: {solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.fila} | Livello: L{solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.livello}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '10px' }}>
                  {SOLETTA_PILES.map(pile => (
                    <button
                      key={pile}
                      className="btn btn-secondary"
                      style={{ justifyContent: 'center', padding: '10px' }}
                      onClick={() => handleSolettaRelocation(pile)}
                    >
                      {pile}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSolettaRelocationFlow(null)}
                  >
                    Annulla
                  </button>
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

          {hoveredArticolo && <DetailTooltip vasca={hoveredArticolo} pos={mousePos} />}
        </>
      )}
    </div>
  );
};

export default LogiTrackVasche;
