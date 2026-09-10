import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

function currentShift() {
  const hour = new Date().getHours();
  return hour >= 16 || hour < 7 ? 'PM' : 'AM';
}

const today = () => new Date().toISOString().slice(0, 10);

export default function PackLogs() {
  const [products, setProducts] = useState([]);
  const [packers, setPackers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ shift: currentShift(), packer_id: '', product_id: '', unit_id: '', quantity: '' });

  function loadStatic() {
    Promise.all([client.get('/api/products'), client.get('/api/packers')])
      .then(([p, pk]) => { setProducts(p.data); setPackers(pk.data); })
      .catch((e) => setError(e.message));
  }

  function loadSummary() {
    client.get('/api/pack-logs/quota-summary', { params: { date: today(), shift: form.shift } })
      .then((r) => setSummary(r.data))
      .catch((e) => setError(e.message));
  }

  useEffect(loadStatic, []);
  useEffect(loadSummary, [form.shift]);

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
      await client.post('/api/pack-logs', form);
      setForm((f) => ({ ...f, quantity: '' }));
      loadSummary();
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
          <h1 className="page-title">Packing quota</h1>
          <p className="page-subtitle">85 packs per shift, tracked per packer, product &amp; SKU</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-olive">
        <div className="panel-title">Log packs</div>
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
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
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
              <label>Packs</label>
              <input type="number" step="1" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Logging…' : 'Log packs'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Today's quota — {form.shift} shift</div>
        {!summary || summary.packers.length === 0 ? (
          <div className="empty-state">No packers on file.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Packer</th><th>Packed</th><th>Quota</th><th>Status</th><th>Product / SKU breakdown</th></tr>
            </thead>
            <tbody>
              {summary.packers.map((p) => (
                <tr key={p.packer_id}>
                  <td>BY {p.packer_no}</td>
                  <td className="num">{p.total_packed}</td>
                  <td className="num">{p.quota}</td>
                  <td>
                    <span className={`badge ${p.quota_met ? 'online' : 'pending'}`}>
                      {p.quota_met ? 'Quota met' : `${p.remaining} to go`}
                    </span>
                  </td>
                  <td>
                    {p.items.length === 0 ? (
                      <span className="page-subtitle">—</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {p.items.map((it, i) => (
                          <li key={i} className="mono" style={{ fontSize: '0.85em' }}>
                            {it.product_name} ({it.sku}) · {it.unit_code} × {it.quantity}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
