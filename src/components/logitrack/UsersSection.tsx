import React from 'react';
import { Search, Trash2, Plus } from 'lucide-react';

interface AppUser {
  id: string;
  username: string;
  ruolo: 'ADMIN' | 'OPERATORE';
}

interface UserFormData {
  username: string;
  password: string;
  ruolo: 'ADMIN' | 'OPERATORE';
}

interface UsersSectionProps {
  filteredUsers: AppUser[];
  userSearchTerm: string;
  setUserSearchTerm: (value: string) => void;
  userRoleFilter: 'ALL' | 'ADMIN' | 'OPERATORE';
  setUserRoleFilter: (value: 'ALL' | 'ADMIN' | 'OPERATORE') => void;
  isTabletLayout: boolean;
  userFormData: UserFormData;
  setUserFormData: (value: UserFormData) => void;
  handleCreateUser: () => void;
  handleDeleteUser: (id: string) => void;
}

export default function UsersSection({
  filteredUsers,
  userSearchTerm,
  setUserSearchTerm,
  userRoleFilter,
  setUserRoleFilter,
  isTabletLayout,
  userFormData,
  setUserFormData,
  handleCreateUser,
  handleDeleteUser
}: UsersSectionProps) {
  return (
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
          <div className="table-scroll">
            <table className="log-table users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th className="col-optional-tablet">Password</th>
                  <th>Ruolo</th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={isTabletLayout ? 3 : 4} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                      Nessun utente corrisponde ai filtri selezionati
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>{u.username}</td>
                      <td className="col-optional-tablet" style={{ color: '#94a3b8', fontSize: '12px' }}>********</td>
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
  );
}
