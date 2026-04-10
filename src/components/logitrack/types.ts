export interface Articolo {
  id: string;
  codice: string;
  cliente: string;
  commessa: string;
  lunghezza: number;
  altezzaVascaCm?: number | null;
  lunghezzaSolettaCm?: number | null;
  altezzaSolettaCm?: number | null;
  posizione: string | null;
  fila: string | null;
  offsetInizio: number | null;
  tipo: 'VASCA' | 'SOLETTA';
  livello: number;
  colore: string;
  stato: 'CREATA' | 'IN_AREA' | 'SPEDITA';
  dataCreazione: string;
}

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  ruolo: 'ADMIN' | 'OPERATORE';
}

export interface LogEntry {
  id: string;
  tipo: 'CREAZIONE' | 'ENTRATA' | 'SPOSTAMENTO' | 'MOVIMENTAZIONE' | 'USCITA' | 'SPEDIZIONE';
  vascaId?: string;
  vascaCodice: string;
  vascaColore: string;
  dettagli: string;
  utenteNome?: string;
  timestamp: number;
  recordedAt?: number;
  eventAt?: number;
}

export interface GridConfig {
  rows: string[];
  verticalRows?: string[];
  totalLength: number;
  rowLengths?: Record<string, number>;
  pixelsPerMeter: number;
}

export interface SolettaRelocationFlow {
  target: Articolo;
  blockers: Articolo[];
  currentIndex: number;
  finalAction: 'ship' | 'move';
  destinationPile?: string;
  history: Array<{ codice: string; fromPile: string; toPile: string; level: number }>;
}
