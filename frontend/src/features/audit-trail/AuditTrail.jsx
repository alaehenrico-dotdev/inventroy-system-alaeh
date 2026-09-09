import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function AuditTrail() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/api/audit-trail', { params: { limit: 200 } })
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Audit trail</h1>
          <p className="page-subtitle">Append-only record of every write, for reconciling counts</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        {rows.length === 0 ? <div className="empty-state">No activity recorded yet.</div> : (
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.performed_at.slice(0, 19).replace('T', ' ')}</td>
                  <td>{r.action}</td>
                  <td className="mono">{r.entity}</td>
                  <td className="num">{r.entity_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
