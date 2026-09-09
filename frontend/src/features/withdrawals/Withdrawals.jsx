import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

function currentShift() {
  const hour = new Date().getHours();
  return hour >= 16 || hour < 7 ? 'PM' : 'AM';
}

export default function Withdrawals() {
  const [products, setProducts] = useState([]);
  const [packers, setPackers] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ shift: currentShift(), packer_id: '', product_id: '', unit_id: '', quantity: '' });

  function load() {
    Promise.all([
      client.get('/api/products'),
      client.get('/api/packers'),
      client.get('/api/withdrawals', { params: { date: new Date().toISOString().slice(0, 10) } }),
    ]).then(([p, pk, w]) => { setProducts(p.data); setPackers(pk.data); setRows(w.data); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.packer_id || !form.product_id || !form.unit_id || !form.quantity) {
      setError('Fill in packer, product, unit and quantity.');
      return;
    }
    setSaving(true);
    try {
      await client.post('/api/withdrawals', form);
      setForm((f) => ({ ...f, quantity: '' }));
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
          <h1 className="page-title">1st-hour withdrawal</h1>
          <p className="page-subtitle">Production → Packing pulls, logged per unit moved - replaces the raw tally page</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-olive">
        <div className="panel-title">Log a withdrawal</div>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Shift</label>
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
                <option value="AM">AM (7:00 AM – 4:00 PM)</option>
                <option value="PM">PM (4:00 PM – 1:00 AM)</option>
              </select>
            </div>
            <div className="field">
              <label>Packer</label>
              <select value={form.packer_id} onChange={(e) => setForm({ ...form, packer_id: e.target.value })}>
                <option value="">Select packer…</option>
                {packers.map((p) => <option key={p.id} value={p.id}>BY {p.packer_no}</option>)}
              </select>
            </div>
          </div>
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
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Logging…' : 'Log withdrawal'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Today's withdrawals ({rows.length})</div>
        {rows.length === 0 ? (
          <div className="empty-state">Nothing logged yet today.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Time</th><th>Shift</th><th>Packer</th><th>Product</th><th>Unit</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.withdrawn_at.slice(11, 16)}</td>
                  <td>{r.shift}</td>
                  <td>BY {r.packer_no}</td>
                  <td>{r.product_name}</td>
                  <td className="mono">{r.unit_code}</td>
                  <td className="num">{Number(r.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
