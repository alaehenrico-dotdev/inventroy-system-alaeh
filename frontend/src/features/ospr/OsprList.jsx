import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../shared/api/client.js';

export default function OsprList() {
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batch_date: new Date().toISOString().slice(0, 10),
    prepared_by: '',
    courier: 'JNT',
  });

  function load() {
    client.get('/api/ospr/batches').then((r) => setBatches(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function handleOpen(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await client.post('/api/ospr/batches', form);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">OSPR batches</h1>
          <p className="page-subtitle">Online Shop Packing Report - one sheet per courier run</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-amber">
        <div className="panel-title">Open a new OSPR sheet</div>
        <form onSubmit={handleOpen}>
          <div className="field-row">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.batch_date} onChange={(e) => setForm({ ...form, batch_date: e.target.value })} />
            </div>
            <div className="field">
              <label>Prepared by</label>
              <input value={form.prepared_by} onChange={(e) => setForm({ ...form, prepared_by: e.target.value })} placeholder="e.g. Ann" />
            </div>
            <div className="field">
              <label>Courier</label>
              <select value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}>
                {['JNT', 'JTE', 'LEX', 'SPX'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Opening…' : 'Open batch'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">All batches ({batches.length})</div>
        {batches.length === 0 ? (
          <div className="empty-state">No batches yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Prepared by</th><th>Packed by</th><th>Courier</th><th>Status</th><th>Items</th><th></th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.batch_date}</td>
                  <td>{b.prepared_by || '—'}</td>
                  <td>{b.packed_by_no ? `BY ${b.packed_by_no}` : '—'}</td>
                  <td>{b.courier || '—'}</td>
                  <td><span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span></td>
                  <td className="num">{b.item_count}</td>
                  <td><Link to={`/ospr/${b.id}`} className="btn small ghost">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
