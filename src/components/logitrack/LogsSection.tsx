import React from 'react';
import { Calendar, Clock, User, Hash, ChevronUp, ChevronDown } from 'lucide-react';

interface LogEntry {
  id: string;
  tipo: string;
  vascaCodice: string;
  vascaColore: string;
  dettagli: string;
  utenteNome?: string;
  timestamp: number;
  recordedAt?: number;
  eventAt?: number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface LogsSectionProps {
  sortedRegistro: LogEntry[];
  sortConfig: SortConfig;
  requestSort: (key: any) => void;
  isTabletLayout: boolean;
}

export default function LogsSection({
  sortedRegistro,
  sortConfig,
  requestSort,
  isTabletLayout
}: LogsSectionProps) {
  return (
    <div className="grid-section" style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px' }}>Registro operazioni</h2>
      </div>
      <div className="table-scroll">
        <table className="log-table">
          <thead>
            <tr>
              <th className="col-optional-tablet" onClick={() => requestSort('timestamp')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> Registrazione
                  {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                </div>
              </th>
              <th onClick={() => requestSort('eventAt')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> Data movimento
                  {sortConfig.key === 'eventAt' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
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
              <th className="col-optional-tablet" onClick={() => requestSort('utenteNome')}>
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
              <tr><td colSpan={isTabletLayout ? 4 : 6} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Nessuna attività registrata</td></tr>
            ) : (
              sortedRegistro.map((log) => (
                <tr key={log.id}>
                  <td className="col-optional-tablet" style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                    {new Date(log.recordedAt || log.timestamp).toLocaleDateString()} <span style={{ opacity: 0.5 }}>-</span> {new Date(log.recordedAt || log.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                    {new Date(log.eventAt || log.recordedAt || log.timestamp).toLocaleDateString()} <span style={{ opacity: 0.5 }}>-</span> {new Date(log.eventAt || log.recordedAt || log.timestamp).toLocaleTimeString()}
                  </td>
                  <td><span className={`log-type ${String(log.tipo).toLowerCase()}`}>{log.tipo}</span></td>
                  <td style={{ fontWeight: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: log.vascaColore }}></div>{log.vascaCodice}</div></td>
                  <td className="log-operator col-optional-tablet"><User size={12} /> {log.utenteNome || '---'}</td>
                  <td style={{ color: '#475569' }}>{log.dettagli}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
