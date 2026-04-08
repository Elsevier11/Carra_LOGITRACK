import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Plus, Trash2, Move, Package, AlertCircle, Check, X, Calendar, Clock, User, Hash, ChevronUp, ChevronDown, Waves, Layers3 } from 'lucide-react';

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
  tipo: 'VASCA' | 'SOLETTA';
  livello: number;
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
  history: Array<{ codice: string; fromPile: string; toPile: string; level: number }>;
}

/**
 * CONSTANTS
 */
const SOLETTA_PILES = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
const SOLETTA_MAX_LEVELS = 10;
const SOLETTA_LEVEL_HEIGHT_PX = 20;
const SOLETTA_DEFAULT_LENGTH = 2;

const GRID_CONFIGS: Record<'VASCA' | 'SOLETTA', GridConfig> = {
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

const CATEGORY_LABELS = {
  VASCA: { tab: 'Vasche', singular: 'vasca', plural: 'Vasche' },
  SOLETTA: { tab: 'Solette', singular: 'soletta', plural: 'Solette' },
} as const;

/**
 * UI SUB-COMPONENTS
 */

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
    {vasca.tipo !== 'SOLETTA' && (
      <div className="tooltip-row">
        <span className="tooltip-label">Lunghezza:</span>
        <span className="tooltip-value">{vasca.lunghezza}m</span>
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

/**
 * MAIN COMPONENT
 */
const LogiTrackVasche = () => {
  // --- States ---
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [currentCategory, setCurrentCategory] = useState<'VASCA' | 'SOLETTA'>('VASCA');

  const currentGridConfig = useMemo(() => GRID_CONFIGS[currentCategory], [currentCategory]);
  const [registro, setRegistro] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'logs' | 'utenti'>('grid');
  const [utenti, setUtenti] = useState<AppUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'ADMIN' | 'OPERATORE'>('ALL');
  const [userFormData, setUserFormData] = useState({ username: '', password: '', ruolo: 'OPERATORE' as 'ADMIN' | 'OPERATORE' });
  const [searchCliente, setSearchCliente] = useState('');
  const [searchCommessa, setSearchCommessa] = useState('');
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);
  const [showCommessaSuggestions, setShowCommessaSuggestions] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'in_area' | 'creata'>('all');
  const [selectedArticolo, setSelectedArticolo] = useState<Articolo | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [mode, setMode] = useState<'view' | 'position' | 'move'>('view');
  const [ghostPosition, setGhostPosition] = useState<string | null>(null);
  const [hoveredArticolo, setHoveredArticolo] = useState<Articolo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({ codice: '', cliente: '', commessa: '', lunghezza: '' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof LogEntry | 'vascaCodice'; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [solettaRelocationFlow, setSolettaRelocationFlow] = useState<SolettaRelocationFlow | null>(null);
  const [onlyActionable, setOnlyActionable] = useState(false);
  const [recentlyMovedIds, setRecentlyMovedIds] = useState<string[]>([]);
  const flowTargetId = solettaRelocationFlow?.target.id;
  const flowCurrentBlockerId = solettaRelocationFlow?.blockers[solettaRelocationFlow.currentIndex]?.id;
  const flowBlockerIds = new Set<string>();
  solettaRelocationFlow?.blockers.forEach(blocker => flowBlockerIds.add(blocker.id));

  const getFlowClasses = (articolo: Articolo) => {
    if (!solettaRelocationFlow) return '';
    const classes: string[] = [];
    if (flowTargetId === articolo.id) classes.push('flow-target');
    if (flowCurrentBlockerId === articolo.id) classes.push('flow-current');
    else if (flowBlockerIds.has(articolo.id)) classes.push('flow-blocker');
    return classes.join(' ');
  };
  const currentFlowStep = solettaRelocationFlow?.blockers[solettaRelocationFlow.currentIndex];
  const flowSteps = solettaRelocationFlow
    ? solettaRelocationFlow.blockers.map((blocker, index) => {
        const status = index < solettaRelocationFlow.currentIndex
          ? 'done'
          : index === solettaRelocationFlow.currentIndex
            ? 'current'
            : 'pending';
        return {
          id: blocker.codice,
          number: index + 1,
          pile: blocker.fila ?? 'pila attuale',
          level: blocker.livello,
          status,
          statusLabel: status === 'done' ? 'Completata' : status === 'current' ? 'Da spostare ora' : 'In attesa'
        };
      })
    : [];
  const flowInstructionText = currentFlowStep
    ? `Sposta prima ${currentFlowStep.codice} (${currentFlowStep.fila ?? 'pila attuale'}, L${currentFlowStep.livello})`
    : 'Segui la sequenza per liberare la pila.';
  const inventoryListRef = useRef<HTMLDivElement | null>(null);
  const visibleCategories = useMemo(() => (['VASCA', 'SOLETTA'] as const), []);
  const normalizeTipo = useCallback((tipo: string): Articolo['tipo'] | null => {
    if (tipo === 'COPERCHIO') return 'SOLETTA';
    if (tipo === 'VASCA' || tipo === 'SOLETTA') return tipo;
    return null;
  }, []);

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('logitrack_current_user');
      if (!rawUser) return;
      setCurrentUser(JSON.parse(rawUser));
    } catch (err) {
      console.error('Errore nel ripristino sessione utente:', err);
    }
  }, []);

  useEffect(() => {
    try {
      const rawCategory = window.localStorage.getItem('logitrack_current_category');
      if (rawCategory === 'VASCA' || rawCategory === 'SOLETTA') {
        setCurrentCategory(rawCategory);
      }
    } catch (err) {
      console.error('Errore nel ripristino categoria attiva:', err);
    }
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
          fetch('/api/articoli'),
          fetch('/api/registro')
        ]);
        const dataVasche = await resVasche.json();
        const dataRegistro = await resRegistro.json();
        const mappedVasche: Articolo[] = dataVasche
          .map((v: any) => {
            const tipo = normalizeTipo(v.tipo);
            return tipo ? { ...v, tipo } : null;
          })
          .filter(Boolean) as Articolo[];
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
            fetch(`/api/articoli/${v.id}`, {
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (!selectedArticolo) return;

      if (e.key.toLowerCase() === 'p' && selectedArticolo.stato === 'CREATA') {
        e.preventDefault();
        setMode('position');
      }
      if (e.key.toLowerCase() === 'm' && selectedArticolo.stato === 'IN_AREA') {
        e.preventDefault();
        setMode('move');
      }
      if (e.key.toLowerCase() === 's' && selectedArticolo.stato === 'IN_AREA') {
        e.preventDefault();
        handleScaricaArticolo(selectedArticolo);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('view');
        setSelectedArticolo(null);
        setGhostPosition(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedArticolo]);

  const fetchUtenti = async () => {
    try {
      const res = await fetch('/api/utenti');
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
      const res = await fetch('/api/utenti', {
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
      const res = await fetch(`/api/utenti/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUtenti();
    } catch (err) {
      console.error('Errore eliminazione utente:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
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

  const getStatusMeta = useCallback((stato: Articolo['stato']) => {
    if (stato === 'IN_AREA') return { label: 'IN PIAZZALE', className: 'status-pill in-area' };
    if (stato === 'CREATA') return { label: 'IN ATTESA', className: 'status-pill created' };
    return { label: 'SCARICATA', className: 'status-pill shipped' };
  }, []);

  const getPileLoadStyle = useCallback((occupied: number) => {
    const ratio = occupied / SOLETTA_MAX_LEVELS;
    if (ratio >= 0.9) return { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' };
    if (ratio >= 0.6) return { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' };
    return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' };
  }, []);

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
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
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
    } else {
      const filaLength = getFilaLength(fila);
      if (offset < 0 || offset + lunghezza > filaLength) {
        return { available: false, reason: 'Spazio insufficiente nella fila' };
      }
    }

    let topLevel = 0;
    let solettaCountInPile = 0;
    const isStackable = tipo === 'SOLETTA';

    for (const v of articoli) {
      if (v.id === excludeId || v.stato !== 'IN_AREA' || v.fila !== fila || v.offsetInizio === null) continue;

      if (tipo === 'SOLETTA' && v.tipo === 'SOLETTA') {
        solettaCountInPile += 1;
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

    if (tipo === 'SOLETTA' && solettaCountInPile >= SOLETTA_MAX_LEVELS) {
      return { available: false, reason: `Pila piena: massimo ${SOLETTA_MAX_LEVELS} solette` };
    }
    if (tipo === 'SOLETTA') {
      return { available: true, nextLevel: solettaCountInPile + 1 };
    }

    return { available: true, nextLevel: topLevel + 1 };
  }, [articoli, currentGridConfig, getFilaLength]);

  // --- Computed Data ---
  const activeArticoli = useMemo(() => {
    return articoli.filter(v => v.tipo === currentCategory && v.stato !== 'SPEDITA');
  }, [articoli, currentCategory]);

  const filteredVasche = useMemo(() => {
    return activeArticoli.filter(v => {
      const matchCliente = v.cliente.toLowerCase().includes(searchCliente.toLowerCase());
      const matchCommessa = v.commessa.toLowerCase().includes(searchCommessa.toLowerCase());

      const matchType =
        filterType === 'all' ||
        (filterType === 'in_area' && v.stato === 'IN_AREA') ||
        (filterType === 'creata' && v.stato === 'CREATA');
      const actionable =
        mode === 'position' ? v.stato === 'CREATA'
          : mode === 'move' ? v.stato === 'IN_AREA'
            : true;
      const matchActionable = onlyActionable ? actionable : true;
      return matchCliente && matchCommessa && matchType && matchActionable;
    });
  }, [activeArticoli, searchCliente, searchCommessa, filterType, mode, onlyActionable]);

  const clienteSuggestions = useMemo(() => {
    if (!searchCliente) return [];
    return Array.from(new Set(
      activeArticoli
        .map(v => v.cliente)
        .filter(c => c.toLowerCase().includes(searchCliente.toLowerCase()) && c.toLowerCase() !== searchCliente.toLowerCase())
    )).slice(0, 5);
  }, [activeArticoli, searchCliente]);

  const commessaSuggestions = useMemo(() => {
    if (!searchCommessa) return [];
    return Array.from(new Set(
      activeArticoli
        .map(v => v.commessa)
        .filter(c => c.toLowerCase().includes(searchCommessa.toLowerCase()) && c.toLowerCase() !== searchCommessa.toLowerCase())
    )).slice(0, 5);
  }, [activeArticoli, searchCommessa]);

  const prioritizeSelectedArticolo = useCallback((items: Articolo[]) => {
    if (!selectedArticolo) return items;

    const selectedIndex = items.findIndex(v => v.id === selectedArticolo.id);
    if (selectedIndex <= 0) return items;

    const reordered = [...items];
    const [selectedItem] = reordered.splice(selectedIndex, 1);
    reordered.unshift(selectedItem);
    return reordered;
  }, [selectedArticolo]);

  const groupedFilteredArticoli = useMemo(() => {
    return {
      creata: prioritizeSelectedArticolo(filteredVasche.filter(v => v.stato === 'CREATA')),
      inArea: prioritizeSelectedArticolo(filteredVasche.filter(v => v.stato === 'IN_AREA'))
    };
  }, [filteredVasche, prioritizeSelectedArticolo]);

  useEffect(() => {
    if (!selectedArticolo || !inventoryListRef.current) return;
    inventoryListRef.current.scrollTop = 0;
  }, [selectedArticolo]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [activeTab, currentCategory]);

  useEffect(() => {
    try {
      if (currentUser) {
        window.localStorage.setItem('logitrack_current_user', JSON.stringify(currentUser));
      } else {
        window.localStorage.removeItem('logitrack_current_user');
      }
    } catch (err) {
      console.error('Errore nel salvataggio sessione utente:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem('logitrack_current_category', currentCategory);
    } catch (err) {
      console.error('Errore nel salvataggio categoria attiva:', err);
    }
  }, [currentCategory]);

  const filteredUsers = useMemo(() => {
    return utenti
      .filter(u => userRoleFilter === 'ALL' || u.ruolo === userRoleFilter)
      .filter(u => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [utenti, userRoleFilter, userSearchTerm]);

  const validRelocationPiles = useMemo(() => {
    if (!solettaRelocationFlow) return new Set<string>();
    const current = solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex];
    if (!current) return new Set<string>();
    const valid = new Set<string>();
    SOLETTA_PILES.forEach(pile => {
      if (pile === current.fila) return;
      if (solettaRelocationFlow.finalAction === 'move' && pile === solettaRelocationFlow.destinationPile) return;
      const check = isPositionAvailable(pile, 0, current.lunghezza, current.id, 'SOLETTA');
      if (check.available) valid.add(pile);
    });
    return valid;
  }, [solettaRelocationFlow, isPositionAvailable]);

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
    const isSoletta = currentCategory === 'SOLETTA';
    if (!codice || !cliente || !commessa || (!isSoletta && !lunghezza)) {
      alert('Tutti i campi obbligatori devono essere compilati');
      return;
    }

    // Check for duplicate code locally
    const isDuplicate = articoli.some(v => v.codice.trim().toUpperCase() === codice.trim().toUpperCase());
    if (isDuplicate) {
      alert(`Il codice articolo '${codice}' esiste giÃ .`);
      return;
    }

    const numLunghezza = isSoletta
      ? SOLETTA_DEFAULT_LENGTH
      : Number(lunghezza.toString().replace(',', '.'));
    if (!isSoletta && (isNaN(numLunghezza) || numLunghezza <= 0)) {
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

      const res = await fetch('/api/articoli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newArticolo.id,
          codice: newArticolo.codice,
          cliente: newArticolo.cliente,
          commessa: newArticolo.commessa,
          lunghezza: newArticolo.lunghezza,
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
        setFormData({ codice: '', cliente: '', commessa: '', lunghezza: '' });
        setSelectedArticolo(newArticolo);
        setFilterType('creata');
        setMode('position');
        setGhostPosition(null);
        setActiveTab('grid');
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
    // Ricalcola i livelli per gli articoli rimasti in una pila.
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
              posizione: v.tipo === 'SOLETTA'
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
        const movedIds = updates.map(u => u.id);
        setRecentlyMovedIds(prev => Array.from(new Set([...prev, ...movedIds])));
        setTimeout(() => {
          setRecentlyMovedIds(prev => prev.filter(id => !movedIds.includes(id)));
        }, 900);
        setTimeout(async () => {
          for (const up of updates) {
            try {
              await fetch(`/api/articoli/${up.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ livello: up.livello, posizione: up.posizione })
              });
              const posLabel = up.tipo === 'SOLETTA' ? 'Pila' : `${up.offsetInizio?.toFixed(2)}m`;
              const levelLabel = `L${up.livello}`;
              addLog('MOVIMENTAZIONE', up, `Caduta automatica in ${fila} @ ${posLabel} (${levelLabel})`);
            } catch (err) {
              console.error(`Errore ricalcolo gravitÃ  per ${up.codice}:`, err);
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
      const res = await fetch(`/api/articoli/${vascaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fila: newFila,
          offsetInizio: newOffset,
          stato: newState,
          livello: newLevel,
          posizione: newFila
            ? (vasca?.tipo === 'SOLETTA'
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
                ? (v.tipo === 'SOLETTA'
                    ? `${newFila} @ Pila (L${newLevel})`
                    : `${newFila} @ ${newOffset?.toFixed(2)}m (L${newLevel})`)
                : null
            }
            : v
        ));
        setRecentlyMovedIds(prev => Array.from(new Set([...prev, vascaId])));
        setTimeout(() => {
          setRecentlyMovedIds(prev => prev.filter(id => id !== vascaId));
        }, 700);
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
        console.error('Failed to move articolo:', await res.text());
        alert("Errore nello spostamento dell'articolo.");
        return false;
      }
    } catch (err) {
      console.error("Errore nello spostamento dell'articolo:", err);
      alert('Errore di rete o del server.');
      return false;
    }
  };

  const handlePositionArticolo = (fila: string, offset: number) => {
    if (!selectedArticolo || mode !== 'position') return;

    // Per i pozzetti, l'offset passato Ã¨ giÃ  lo slot (1-10)
    const check = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, null, selectedArticolo.tipo);
    if (!check.available) {
      alert(`Errore: ${check.reason}`);
      return;
    }
    const nextLevel = (check as any).nextLevel || 1;
    const posLabel = selectedArticolo.tipo === 'SOLETTA'
      ? `Pila ${fila} (L${nextLevel})`
      : `${offset.toFixed(2)}m`;

    setShowConfirmModal({
      message: `Posizionare ${selectedArticolo.codice} in fila ${fila} a ${posLabel}?`,
      onConfirm: () => {
        moveArticolo(selectedArticolo.id, fila, offset, 'IN_AREA', 'ENTRATA', `Posizionata in ${fila} @ ${posLabel}`, nextLevel);
        setShowConfirmModal(null);
      }
    });
  };

  const handleMoveArticolo = (fila: string, offset: number) => {
    if (!selectedArticolo || mode !== 'move') return;
    if (selectedArticolo.tipo === 'SOLETTA') {
      if (fila === selectedArticolo.fila) {
        alert('Seleziona una pila diversa da quella attuale.');
        return;
      }
      const destinationCheck = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, selectedArticolo.id, selectedArticolo.tipo);
      if (!destinationCheck.available) {
        alert(`Destinazione non disponibile: ${destinationCheck.reason}`);
        return;
      }
      const blockers = getSolettaBlockers(selectedArticolo);
      if (blockers.length > 0) {
        startSolettaRelocationFlow(selectedArticolo, 'move', fila);
        return;
      }
    }
    const check = isPositionAvailable(fila, offset, selectedArticolo.lunghezza, selectedArticolo.id, selectedArticolo.tipo);
    if (!check.available) {
      alert(`Errore: ${check.reason}`);
      return;
    }
    const nextLevel = (check as any).nextLevel || 1;
    const posLabel = selectedArticolo.tipo === 'SOLETTA'
      ? `Pila ${fila} (L${nextLevel})`
      : `${offset.toFixed(2)}m`;

    setShowConfirmModal({
      message: `Spostare ${selectedArticolo.codice} in fila ${fila} a ${posLabel}?`,
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
          message: `Scaricare ${target.codice}? La posizione sarÃ  liberata.`,
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
      destinationPile,
      history: []
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
      alert(`Errore: ${check.reason}`);
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

    const stepRecord = {
      codice: current.codice,
      fromPile: current.fila || '-',
      toPile: destinationPile,
      level: nextLevel
    };

    const isLast = solettaRelocationFlow.currentIndex >= solettaRelocationFlow.blockers.length - 1;
    if (isLast) {
      const target = solettaRelocationFlow.target;
      const finalAction = solettaRelocationFlow.finalAction;
      const destinationPile = solettaRelocationFlow.destinationPile;
      const flowHistory = [...solettaRelocationFlow.history, stepRecord];
      setSolettaRelocationFlow(null);
      if (finalAction === 'ship') {
        setShowConfirmModal({
          message: `Riposizionamento completato (${flowHistory.length} movimenti). Scaricare ${target.codice}?`,
          onConfirm: () => {
            executeShipArticolo(target);
            setShowConfirmModal(null);
          }
        });
      } else if (finalAction === 'move' && destinationPile) {
        const targetNow = articoli.find(v => v.id === target.id) || target;
        const targetCheck = isPositionAvailable(destinationPile, 0, targetNow.lunghezza, targetNow.id, 'SOLETTA');
        if (!targetCheck.available) {
          alert(`Errore: ${targetCheck.reason}`);
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

    setSolettaRelocationFlow(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1,
        history: [
          ...prev.history,
          stepRecord
        ]
      };
    });
  };

  const executeShipArticolo = async (vasca: Articolo) => {
    // LIFO check for stacked items.
    if (vasca.tipo === 'SOLETTA') {
      const itemAbove = articoli.find(v =>
        v.stato === 'IN_AREA' &&
        v.fila === vasca.fila &&
        v.offsetInizio !== null &&
        Math.abs(v.offsetInizio - (vasca.offsetInizio || 0)) < 0.1 &&
        v.livello > vasca.livello
      );
      if (itemAbove) {
        alert(`Errore LIFO: impossibile scaricare. Sopra c'Ã¨ ${itemAbove.tipo.toLowerCase()} ${itemAbove.codice}.`);
        return;
      }
    }

    try {
      const res = await fetch(`/api/articoli/${vasca.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posizione: null, stato: 'SPEDITA', livello: 0, fila: null, offsetInizio: null })
      });
      if (res.ok) {
        setArticoli(prev => (prev as Articolo[]).map(v =>
          v.id === vasca.id ? { ...v, posizione: null, stato: 'SPEDITA', livello: 0, fila: null, offsetInizio: null } : v
        ));
        addLog('SPEDIZIONE', vasca, 'Articolo scaricato correttamente');

        if (vasca.fila && vasca.offsetInizio !== null) {
          applyGravity(vasca.fila, vasca.offsetInizio);
        }

        setSelectedArticolo(null);
      } else {
        console.error('Failed to ship articolo:', await res.text());
        alert("Errore nello scarico dell'articolo.");
      }
    } catch (err) {
      console.error("Errore nello scarico dell'articolo:", err);
      alert('Errore di rete o del server.');
    }
  };

  const handleScaricaArticolo = (v: Articolo) => {
    if (v.tipo === 'SOLETTA' && v.stato === 'IN_AREA') {
      startSolettaRelocationFlow(v, 'ship');
      return;
    }
    setShowConfirmModal({
      message: `Scaricare ${v.codice}? La posizione sarÃ  liberata.`,
      onConfirm: () => {
        executeShipArticolo(v);
        setShowConfirmModal(null);
      }
    });
  };

  const renderInventoryCard = (v: Articolo) => {
    const statusMeta = getStatusMeta(v.stato);
    const isSelected = selectedArticolo?.id === v.id;
    return (
      <div key={v.id} className={`vasca-card ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedArticolo(v)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: v.colore }}></div>
            <span className="vasca-codice">{v.codice}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isSelected && <span className="selection-pill">Selezionato</span>}
            <span className={statusMeta.className}>
              {statusMeta.label}
            </span>
          </div>
        </div>
        <div className="vasca-info">
          <div><strong>Cliente:</strong> {v.cliente}</div>
          <div><strong>Commessa:</strong> {v.commessa}</div>
                        {v.tipo !== 'SOLETTA' && (
                          <div><strong>Lunghezza:</strong> {v.lunghezza}m</div>
                        )}
          {v.posizione && <div><strong>Posizione:</strong> {v.posizione}</div>}
        </div>
      </div>
    );
  };

  // --- Render ---
  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
        .app { max-width: 100%; margin: 0 auto; padding: 12px 16px; position: relative; }
        
        /* Layout Blocks */
        .header { background: white; padding: 12px 16px; border-radius: 14px; box-shadow: 0 10px 30px -24px rgba(15,23,42,0.45); margin-bottom: 10px; border-top: 3px solid #3b82f6; }
        .header h1 { font-size: 24px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .header p { color: #64748b; font-size: 14px; }
        .header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-left { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .header-right { display: flex; align-items: center; gap: 10px; position: relative; }
        .user-menu { position: relative; }
        .user-menu-trigger { background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%); color: #1d4ed8; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #bfdbfe; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.7); }
        .user-menu-role { color: #64748b; font-weight: 700; }
        .user-menu-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 190px; background: white; border: 1px solid #dbe3ef; border-radius: 14px; box-shadow: 0 18px 40px -20px rgba(15, 23, 42, 0.4); padding: 8px; z-index: 40; }
        .user-menu-item { width: 100%; border: none; background: transparent; text-align: left; padding: 10px 12px; border-radius: 10px; color: #334155; font-size: 13px; font-weight: 700; cursor: pointer; }
        .user-menu-item:hover { background: #f8fafc; }

        .sidebar-panel { display: flex; flex-direction: column; gap: 12px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .sidebar-title { font-size: 18px; font-weight: 800; color: #0f172a; }
        .sidebar-count { font-size: 14px; font-weight: 800; color: #94a3b8; }
        .sidebar-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
        .sidebar-badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .sidebar-badge { border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 800; border: 1px solid #dbe3ef; background: #f8fafc; color: #475569; white-space: nowrap; }
        .sidebar-badge.in-area { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .sidebar-badge.created { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .search-stack { display: grid; gap: 8px; }
        .search-box { display: flex; gap: 8px; }
        .search-container { position: relative; flex: 1; }
        .search-input { width: 100%; padding: 10px 36px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 13px; transition: border-color 0.2s; }
        .search-input:focus { outline: none; border-color: #3b82f6; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        
        .filter-tabs { display: flex; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: 10px; width: 100%; }
        .filter-tab { flex: 1; padding: 8px 10px; border: none; background: transparent; border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 700; color: #64748b; transition: all 0.2s; }
        .filter-tab.active { background: white; color: #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        
        .btn { padding: 10px 14px; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: opacity 0.2s; }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-secondary { background: #e2e8f0; color: #475569; }
        .btn-success { background: #10b981; color: white; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-danger { background: #ef4444; color: white; }
        
        .nav-tabs { display: flex; gap: 16px; border-bottom: 2px solid #e2e8f0; margin-bottom: 12px; align-items: center; background: white; padding: 0 12px; border-radius: 14px 14px 0 0; box-shadow: 0 10px 30px -24px rgba(15,23,42,0.35); }
        .nav-tab { padding: 8px 4px; font-weight: 700; font-size: 15px; color: #64748b; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
        .nav-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
        .mode-badge { margin-left: auto; font-size: 12px; font-weight: 700; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 10px; }
        
        /* Linear Layout (Timeline) */
        .content { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; }
        .content.grid-focus { min-height: calc(100vh - 190px); align-items: stretch; }
        .content.grid-focus .grid-section { display: flex; flex-direction: column; min-height: 0; }
        .content.grid-focus .grid-container { flex: 1; min-height: 0; overflow: auto; }
        .content.grid-focus .sidebar { display: flex; flex-direction: column; min-height: 0; }
        .content.grid-focus .vasca-list { flex: 1; min-height: 0; max-height: none; }
          .grid-section { background: white; padding: 14px; border-radius: 18px; box-shadow: 0 10px 30px -24px rgba(15,23,42,0.35); }
          .grid-container { overflow-x: auto; padding: 4px; }
          .relocation-banner {
            grid-column: span 2;
            background: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 12px;
            font-size: 14px;
            color: #92400e;
          }
        
        .fila-row { display: grid; grid-template-columns: 54px 1fr; gap: 8px; align-items: center; margin-bottom: 8px; padding: 6px; background: #f8fafc; border-radius: 12px; }
        .fila-label { font-weight: 800; font-size: 16px; color: #1e293b; text-align: center; }
        
        .fila-track { 
          height: 52px; 
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
          .vasca-block.flow-blocker { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.45), 0 10px 20px -15px rgba(59, 130, 246, 0.7); }
          .vasca-block.flow-current { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.75), 0 12px 24px -16px rgba(16, 185, 129, 0.65); }
          .vasca-block.flow-target { outline: 2px dashed rgba(249, 115, 22, 0.6); outline-offset: -2px; }

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
          margin-bottom: 10px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
        }
        
        /* Sidebar */
        .sidebar { background: white; padding: 14px; border-radius: 18px; box-shadow: 0 10px 30px -24px rgba(15,23,42,0.35); border: 1px solid #e2e8f0; position: sticky; top: 10px; }
        .vasca-list { max-height: 600px; overflow-y: auto; padding-right: 6px; }
        .selection-card { position: sticky; top: 0; z-index: 6; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); border: 1px solid #bfdbfe; border-radius: 14px; padding: 12px; margin-bottom: 12px; box-shadow: 0 12px 24px -24px rgba(37,99,235,0.45); }
        .selection-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
        .selection-card-title { font-size: 12px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.3px; }
        .selection-card-code { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .selection-card-grid { display: grid; gap: 6px; font-size: 13px; color: #475569; margin-bottom: 12px; }
        .selection-actions { display: flex; gap: 8px; }
        .vasca-card { padding: 10px 12px; border: 2px solid #f1f5f9; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
        .vasca-card:hover { border-color: #cbd5e1; background: #f8fafc; }
        .vasca-card.selected { border-color: #3b82f6; background: #eff6ff; }
        .vasca-info { font-size: 12px; color: #475569; margin-top: 8px; display: grid; gap: 3px; }
        .selection-pill { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 999px; letter-spacing: 0.2px; background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
        .status-pill { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 999px; border: 1px solid transparent; letter-spacing: 0.2px; }
        .status-pill.in-area { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .status-pill.created { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .status-pill.shipped { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .pile-column { display: flex; flex-direction: column; gap: 6px; }
        .pile-index { text-align: center; font-weight: 800; font-size: 13px; color: #0f172a; position: sticky; top: 0; background: #fff; border-radius: 6px; z-index: 3; }
        .pile-capacity { text-align: center; font-size: 11px; border: 1px solid; border-radius: 999px; padding: 4px 6px; font-weight: 700; }
        .quick-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; margin-bottom: 12px; }
        .quick-toggle input { accent-color: #3b82f6; }
        .action-hint { font-size: 11px; color: #64748b; margin-bottom: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
        .gravity-drop { animation: gravityDrop 0.45s ease-out; }
        @keyframes gravityDrop {
          0% { transform: translateY(-14px); }
          100% { transform: translateY(0); }
        }
        .users-layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
        .users-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .role-filter { padding: 8px 10px; border: 1px solid #dbe3ef; border-radius: 10px; background: #fff; color: #334155; font-size: 13px; }
        @media (max-width: 1100px) {
          .header-top { align-items: flex-start; }
          .header-right { width: 100%; justify-content: flex-end; }
          .content { grid-template-columns: 1fr; }
          .content.grid-focus { min-height: auto; }
          .users-layout { grid-template-columns: 1fr; }
          .mode-badge { margin-left: 0; }
          .search-box { flex-direction: column; }
        }
        
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
        .product-tab-content { display: flex; align-items: center; gap: 8px; }
        .product-tab:hover { background: #e2e8f0; }
        .product-tab.active { background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .product-tab.active.vasca { color: #3b82f6; }
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
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Accesso LogiTrack</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>Inserisci le credenziali per operare in piazzale</p>

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
                  placeholder="********"
                />
              </div>
              {loginError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, marginTop: '-12px', marginBottom: '16px' }}>{loginError}</p>}
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Entra
              </button>
            </form>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '12px' }}>
              LogiTrack v2.6 - Accesso riservato
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* HEADER & STATS */}
          <header className="header" style={{ position: 'relative', zIndex: 10 }}>
            <div className="header-top">
              <div className="header-left">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={28} color="#3b82f6" />
                  <h1 style={{ fontSize: '22px', letterSpacing: '-0.4px', marginBottom: 0 }}>LogiTrack <span style={{ color: '#94a3b8', fontWeight: 400 }}>v2.6</span></h1>
                </div>

                <div className="product-tabs">
                  {visibleCategories.map(cat => (
                    <div
                      key={cat}
                      className={`product-tab ${currentCategory === cat ? 'active' : ''} ${cat.toLowerCase()}`}
                      onClick={() => {
                        setCurrentCategory(cat);
                        setSelectedArticolo(null);
                        setMode('view');
                      }}
                    >
                      <div className="product-tab-content">
                        {cat === 'VASCA' ? <Waves size={16} /> : <Layers3 size={16} />}
                        <span>{CATEGORY_LABELS[cat].tab}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="header-right">
                <div className="user-menu">
                  <button
                    className="user-menu-trigger"
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                  >
                    <User size={14} />
                    <span>{currentUser?.username}</span>
                    <span className="user-menu-role">{currentUser?.ruolo === 'ADMIN' ? 'Admin' : 'Operatore'}</span>
                  </button>
                  {isUserMenuOpen && (
                    <div className="user-menu-panel">
                      {currentUser?.ruolo === 'ADMIN' && (
                        <button
                          className="user-menu-item"
                          onClick={() => {
                            setActiveTab('utenti');
                            setIsUserMenuOpen(false);
                          }}
                        >
                          Utenti
                        </button>
                      )}
                      <button
                        className="user-menu-item"
                        onClick={() => {
                          setCurrentUser(null);
                          setLoginForm({ username: '', password: '' });
                          setLoginError('');
                          setIsUserMenuOpen(false);
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* NAVIGATION */}
          <div className="nav-tabs" style={{ position: 'relative', zIndex: 1 }}>
            <div className={`nav-tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
              Planimetria
            </div>
            <div className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
              Registro
            </div>
            {currentUser?.ruolo === 'ADMIN' && (
              <div className={`nav-tab ${activeTab === 'utenti' ? 'active' : ''}`} onClick={() => setActiveTab('utenti')}>
                Utenti
              </div>
            )}
            {activeTab === 'grid' && (
              <div className="mode-badge">
                Modalità: {mode === 'view' ? 'Vista' : mode === 'position' ? 'Posizionamento' : 'Spostamento'}
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
                      {mode === 'position' ? 'Posizionamento attivo' : 'Spostamento attivo'}
                    </div>
                      <div style={{ fontSize: '14px' }}>
                        Seleziona una posizione libera per <strong>{selectedArticolo?.codice}</strong>
                        {selectedArticolo?.tipo !== 'SOLETTA' && (
                          <> ({selectedArticolo?.lunghezza}m)</>
                        )}
                      </div>
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}
                      onClick={() => { setMode('view'); setSelectedArticolo(null); setGhostPosition(null); }}
                    >
                      <X size={14} /> Annulla
                    </button>
                  </div>
                </div>
              )}

                <div className="content grid-focus" style={{ position: 'relative', zIndex: 1 }}>
                  {solettaRelocationFlow && (
                    <div className="relocation-banner">
                      <div>
                        <strong>Passo {solettaRelocationFlow.currentIndex + 1}</strong> di <strong>{solettaRelocationFlow.blockers.length}</strong> – sposta <strong>{solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.codice}</strong> dalla pila <strong>{solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.fila}</strong>.
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        Il sistema ti guida: scegli una pila verde qui sotto, sposta la cima libera e ripeti fino a liberare <strong>{solettaRelocationFlow.target.codice}</strong>.
                      </div>
                    </div>
                  )}
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
                    <div className="grid-content-layout" style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', padding: '8px' }}>
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
                                      className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''} ${getFlowClasses(v)}`}
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
                          (() => {
                            const rows: string[][] = [];
                            for (let i = 0; i < SOLETTA_PILES.length; i += 6) {
                              rows.push(SOLETTA_PILES.slice(i, i + 6));
                            }
                            return (
                              <div style={{ display: 'grid', gap: '14px' }}>
                                {rows.map((row, rowIndex) => (
                                  <div
                                    key={`sol-row-${rowIndex}`}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))',
                                      gap: '12px',
                                      alignItems: 'end'
                                    }}
                                  >
                                    {row.map((pile, index) => {
                                      const pileItems = [...(articoliPerFila[pile] || [])].sort((a, b) => a.livello - b.livello);
                                      const occupiedLevels = pileItems.length;
                                      const pileLoadStyle = getPileLoadStyle(occupiedLevels);
                                      return (
                                        <div key={pile} className="pile-column">
                                          <div className="pile-index">{rowIndex * 6 + index + 1}</div>
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
                                                  className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''} ${recentlyMovedIds.includes(v.id) ? 'gravity-drop' : ''} ${getFlowClasses(v)}`}
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
                                                    fontSize: '9px',
                                                    fontWeight: 800,
                                                    color: '#fff',
                                                    padding: '0 14px 0 6px'
                                                  }}
                                                  onClick={(e: any) => {
                                                    e.stopPropagation();
                                                    setSelectedArticolo(v);
                                                  }}
                                                  onMouseEnter={() => setHoveredArticolo(v)}
                                                  onMouseLeave={() => setHoveredArticolo(null)}
                                                >
                                                  <span style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.codice}>{v.codice}</span>
                                                  <span style={{ position: 'absolute', right: '6px', top: '2px', fontSize: '9px', opacity: 0.9 }}>L{v.livello}</span>
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
                                          <div className="pile-capacity" style={pileLoadStyle}>{occupiedLevels}/{SOLETTA_MAX_LEVELS}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            );
                          })()
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
                                      height: '52px',
                                      background: '#f8fafc',
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

                                      return (
                                        <div
                                          key={v.id}
                                          className={`vasca-block ${selectedArticolo?.id === v.id ? 'selected' : ''} ${isFaded ? 'faded' : ''} ${recentlyMovedIds.includes(v.id) ? 'gravity-drop' : ''} ${getFlowClasses(v)}`}
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
                                          left: isScaledVascaLayout
                                              ? `${((ghostData.offset / filaLength) * 100)}%`
                                              : ghostData.offset * currentGridConfig.pixelsPerMeter,
                                          width: isScaledVascaLayout
                                              ? `${((selectedArticolo!.lunghezza / filaLength) * 100)}%`
                                              : selectedArticolo!.lunghezza * currentGridConfig.pixelsPerMeter,
                                          height: '100%',
                                          bottom: 0,
                                          top: currentCategory === 'VASCA' ? '10%' : 'auto'
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
                  {selectedArticolo && (
                    <div className="selection-card">
                      <div className="selection-card-head">
                        <div className="selection-card-title">Selezionato</div>
                        <span className={getStatusMeta(selectedArticolo.stato).className}>{getStatusMeta(selectedArticolo.stato).label}</span>
                      </div>
                      <div className="selection-card-code">{selectedArticolo.codice}</div>
                      <div className="selection-card-grid">
                        <div><strong>Cliente:</strong> {selectedArticolo.cliente}</div>
                        <div><strong>Commessa:</strong> {selectedArticolo.commessa}</div>
                        {selectedArticolo.tipo !== 'SOLETTA' && (
                          <div><strong>Lunghezza:</strong> {selectedArticolo.lunghezza}m</div>
                        )}
                        {selectedArticolo.posizione && <div><strong>Posizione:</strong> {selectedArticolo.posizione}</div>}
                      </div>
                      {mode === 'view' ? (
                        <div className="selection-actions">
                          {selectedArticolo.stato === 'CREATA' && (
                            <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode('position')}>
                              <Check size={14} /> Posiziona
                            </button>
                          )}
                          {selectedArticolo.stato === 'IN_AREA' && (
                            <>
                              <button className="btn btn-warning" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode('move')}>
                                <Move size={14} /> Sposta
                              </button>
                              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleScaricaArticolo(selectedArticolo)}>
                                <Trash2 size={14} /> Scarica
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="action-hint" style={{ marginBottom: 0 }}>
                          Conferma una posizione sulla planimetria o premi <strong>Esc</strong> per annullare.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="sidebar-panel">
                    <div className="sidebar-head">
                      <div className="sidebar-title">{CATEGORY_LABELS[currentCategory].plural}</div>
                      <div className="sidebar-count">{filteredVasche.length}</div>
                    </div>
                    <div className="sidebar-actions">
                      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> Crea {CATEGORY_LABELS[currentCategory].singular}
                      </button>
                      <div className="sidebar-badges">
                        <div className="sidebar-badge">{activeArticoli.length} attive</div>
                        <div className="sidebar-badge in-area">{activeArticoli.filter(v => v.stato === 'IN_AREA').length} in piazzale</div>
                        <div className="sidebar-badge created">{activeArticoli.filter(v => v.stato === 'CREATA').length} in attesa</div>
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
                  <div className="vasca-list" ref={inventoryListRef}>
                    {groupedFilteredArticoli.inArea.length > 0 && (
                      <>
                        <div className="suggestion-header" style={{ marginBottom: '8px' }}>In piazzale</div>
                        {groupedFilteredArticoli.inArea.map(renderInventoryCard)}
                      </>
                    )}
                    {groupedFilteredArticoli.creata.length > 0 && (
                      <>
                        <div className="suggestion-header" style={{ marginBottom: '8px' }}>In Attesa</div>
                        {groupedFilteredArticoli.creata.map(renderInventoryCard)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'logs' ? (
            <div className="grid-section" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px' }}>Registro operazioni</h2>
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
              <div className="users-layout">
                <div>
                  <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Utenti registrati</h2>
                  <div className="users-toolbar">
                    <div className="search-container" style={{ maxWidth: '320px' }}>
                      <Search className="search-icon" size={16} />
                      <input
                        className="search-input"
                        style={{ padding: '10px 36px' }}
                        value={userSearchTerm}
                        onChange={e => setUserSearchTerm(e.target.value)}
                        placeholder="Cerca utente..."
                      />
                    </div>
                    <select
                      className="role-filter"
                      value={userRoleFilter}
                      onChange={e => setUserRoleFilter(e.target.value as 'ALL' | 'ADMIN' | 'OPERATORE')}
                    >
                      <option value="ALL">Tutti i ruoli</option>
                      <option value="ADMIN">Solo Admin</option>
                      <option value="OPERATORE">Solo Operatori</option>
                    </select>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                      Totale visibili: {filteredUsers.length}
                    </span>
                  </div>
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
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                            Nessun utente corrisponde ai filtri selezionati
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u: AppUser) => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 700 }}>{u.username}</td>
                            <td style={{ color: '#94a3b8', fontSize: '12px' }}>********</td>
                            <td>
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '999px', border: '1px solid', background: u.ruolo === 'ADMIN' ? '#dbeafe' : '#f1f5f9', color: u.ruolo === 'ADMIN' ? '#1e40af' : '#64748b', borderColor: u.ruolo === 'ADMIN' ? '#bfdbfe' : '#e2e8f0' }}>
                                {u.ruolo}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {u.username !== 'admin' && (
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '6px 10px', borderRadius: '8px', marginLeft: 'auto', fontSize: '12px' }}
                                  onClick={() => handleDeleteUser(u.id)}
                                >
                                  <Trash2 size={14} /> Elimina
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="sidebar" style={{ width: '100%' }}>
                  <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>Crea utente</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Inserisci i dati e assegna il ruolo.</p>
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
                      placeholder="Password iniziale"
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
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }} onClick={handleCreateUser}>
                    <Plus size={18} /> Crea utente
                  </button>
                  <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                    Suggerimento: usa password iniziali semplici da comunicare e cambiale al primo accesso.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODALS */}
          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'grid', gap: '18px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      Nuovo articolo
                    </div>
                    <h2 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Plus color="#3b82f6" /> Crea {CATEGORY_LABELS[currentCategory].singular}
                    </h2>
                    <p style={{ color: '#475569', lineHeight: 1.5 }}>
                      Inserisci i dati identificativi del pezzo. Dopo la creazione l'articolo sar&#224; in attesa e potrai posizionarlo nel piazzale.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '14px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px' }}>
                        Dati identificativi
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label">Codice articolo</label>
                        <input className="form-input" value={formData.codice} onChange={e => setFormData({ ...formData, codice: e.target.value })} placeholder={currentCategory === 'VASCA' ? 'Es. VA7/70' : 'Es. SL_06_FEMMINA'} />
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Usa il codice reale con cui il pezzo viene identificato in produzione o in commessa.</div>
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label">Cliente</label>
                        <input className="form-input" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} placeholder="Es. AGZ APPALTI" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Commessa</label>
                        <input className="form-input" value={formData.commessa} onChange={e => setFormData({ ...formData, commessa: e.target.value })} placeholder="Es. R2213/25" />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' }}>
                          Tipo in creazione
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                          {CATEGORY_LABELS[currentCategory].plural}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>
                          L'articolo verr&#224; creato come attivo, ma non ancora posizionato.
                        </div>
                      </div>

                      {currentCategory !== 'SOLETTA' && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Lunghezza (metri)</label>
                            <input type="number" className="form-input" value={formData.lunghezza} onChange={e => setFormData({ ...formData, lunghezza: e.target.value })} placeholder="Es. 6.12" />
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                              Inserisci la misura in metri. Puoi usare valori decimali.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Annulla</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateArticolo}>Crea {CATEGORY_LABELS[currentCategory].singular}</button>
                </div>
              </div>
            </div>
          )}

          {solettaRelocationFlow && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: '720px' }}>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      Procedura guidata
                    </div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Riposizionamento solette</h2>
                    <p style={{ color: '#475569', lineHeight: 1.5 }}>
                      {solettaRelocationFlow.finalAction === 'ship'
                        ? <>Stai preparando lo scarico di <strong>{solettaRelocationFlow.target.codice}</strong>. Prima devi spostare le solette che si trovano sopra.</>
                        : <>Stai spostando <strong>{solettaRelocationFlow.target.codice}</strong> in <strong>pila {solettaRelocationFlow.destinationPile}</strong>. Prima devi liberare la pila attuale.</>}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
                        Obiettivo finale
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                        {solettaRelocationFlow.finalAction === 'ship'
                          ? `Scaricare ${solettaRelocationFlow.target.codice}`
                          : `Portare ${solettaRelocationFlow.target.codice} in pila ${solettaRelocationFlow.destinationPile}`}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {solettaRelocationFlow.finalAction === 'ship'
                          ? 'Appena completi i riposizionamenti, potrai confermare lo scarico.'
                          : `La pila ${solettaRelocationFlow.destinationPile} resta riservata al pezzo selezionato.`}
                      </div>
                    </div>

                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
                        Azione da fare adesso
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                        Passo <strong>{solettaRelocationFlow.currentIndex + 1}</strong> di <strong>{solettaRelocationFlow.blockers.length}</strong>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                        Clicca una pila verde per spostare <strong>{solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.codice}</strong>
                      </div>
                    </div>
                  </div>
                </div>

        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '16px' }}>
          <div
            style={{
              width: `${((solettaRelocationFlow.currentIndex + 1) / solettaRelocationFlow.blockers.length) * 100}%`,
              height: '100%',
              background: '#3b82f6'
            }}
          />
        </div>

        {flowSteps.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '18px', display: 'grid', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Ordine consigliato
            </div>
            <div style={{ fontSize: '14px', color: '#475569' }}>
              {flowInstructionText} per liberare <strong>{solettaRelocationFlow.target.codice}</strong> dalla pila {solettaRelocationFlow.target.fila ?? 'attuale'}.
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {flowSteps.map(step => {
                const bg = step.status === 'done' ? '#dcfce7' : step.status === 'current' ? '#e0f2fe' : '#f8fafc';
                const border = step.status === 'current' ? '#93c5fd' : '#e2e8f0';
                return (
                  <div
                    key={`${step.id}-${step.number}`}
                    style={{
                      borderRadius: '10px',
                      border: `1px solid ${border}`,
                      background: bg,
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                        Passo {step.number}: {step.id}
                      </span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>{step.statusLabel}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                      Pila {step.pile} &middot; Livello L{step.level}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
                    Soletta da riposizionare
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: '#0f172a', marginBottom: '4px' }}>
                    {solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.codice}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Attualmente in <strong>pila {solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.fila}</strong> al <strong>livello L{solettaRelocationFlow.blockers[solettaRelocationFlow.currentIndex]?.livello}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Pile disponibili per questo passaggio
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '999px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: '12px', fontWeight: 800 }}>
                    Seleziona una pila libera
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '10px' }}>
                  {SOLETTA_PILES.map(pile => {
                    const isValid = validRelocationPiles.has(pile);
                    return (
                    <button
                      key={pile}
                      className="btn btn-secondary"
                      style={{
                        justifyContent: 'center',
                        padding: '12px 10px',
                        border: isValid ? '2px solid #22c55e' : '1px solid #cbd5e1',
                        background: isValid ? 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)' : '#f8fafc',
                        color: isValid ? '#166534' : '#94a3b8',
                        opacity: isValid ? 1 : 0.55,
                        fontWeight: 800,
                        boxShadow: isValid ? '0 8px 18px -14px rgba(34,197,94,0.75)' : 'none'
                      }}
                      disabled={!isValid}
                      onClick={() => handleSolettaRelocation(pile)}
                    >
                      {pile}
                    </button>
                  )})}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '999px', background: '#22c55e', display: 'inline-block' }} />
                    Disponibile
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '999px', background: '#cbd5e1', display: 'inline-block' }} />
                    Non disponibile
                  </div>
                </div>

                {solettaRelocationFlow.history.length > 0 && (
                  <div style={{ marginTop: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>Passi gi&#224; completati</div>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'grid', gap: '6px' }}>
                      {solettaRelocationFlow.history.map((h, i) => (
                        <div key={`${h.codice}-${i}`} style={{ fontSize: '12px', color: '#475569' }}>
                          {i + 1}. {h.codice}: {h.fromPile}{' -> '}{h.toPile} (L{h.level})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={showConfirmModal.onConfirm}><Check size={16} /> Si, procedi</button>
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


