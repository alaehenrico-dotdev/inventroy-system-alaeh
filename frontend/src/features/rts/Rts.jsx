import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function Rts() {
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState({ product_id: '', unit_id: '', quantity: '', category: 'UNSORTED', notes: '' });

  function load() {
    Promise.all([client.get('/api/products'), client.get('/api/rts-triage')])
      .then(([p, r]) => { setProducts(p.data); setRows(r.data); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.product_id || !form.unit_id || !form.quantity) {
      setError('Fill in product, unit and quantity.');
      return;
    }
    setSaving(true);
    try {
      await client.post('/api/rts-triage', form);
      setForm((f) => ({ ...f, quantity: '', notes: '' }));
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
          <h1 className="page-title">RTS triage</h1>
          <p className="page-subtitle">Return-to-sender log for the ONLINE channel - single tally by default</p>
        </div>
        <button className="btn small ghost" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? 'Use simple tally' : 'Break down by category'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-brick">
        <div className="panel-title">Log a return</div>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Product</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, unit_id: '' })}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Unit</label>
              <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} disabled={!selectedProduct}>
                <option value="">Select unit…</option>
                {selectedProduct?.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            {advanced && (
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="GOOD">Good</option>
                  <option value="LEAK">Leak</option>
                  <option value="BAD_ORDER">Bad order</option>
                </select>
              </div>
            )}
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Logging…' : 'Log return'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Recent returns ({rows.length})</div>
        {rows.length === 0 ? (
          <div className="empty-state">No returns logged yet.</div>
        ) : (
          <table>
            <thead><tr><th>Time</th><th>Product</th><th>Unit</th><th>Qty</th><th>Category</th><th>Notes</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.logged_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{r.product_name}</td>
                  <td className="mono">{r.unit_code}</td>
                  <td className="num">{Number(r.quantity).toFixed(2)}</td>
                  <td>{r.category}</td>
                  <td>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
