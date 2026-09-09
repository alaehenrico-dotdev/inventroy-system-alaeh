import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function Transfers() {
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '', unit_id: '', source_channel: 'OFFLINE', destination_channel: 'ONLINE',
    quantity: '', reason_code: 'LOW_STOCK',
  });

  function load() {
    Promise.all([client.get('/api/products'), client.get('/api/transfers')])
      .then(([p, t]) => { setProducts(p.data); setTransfers(t.data); })
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
      await client.post('/api/transfers', form);
      setForm((f) => ({ ...f, quantity: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id) {
    try {
      await client.put('/api/transfers', { id });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Inter-channel transfer ledger</h1>
          <p className="page-subtitle">The only sanctioned path to move stock between ONLINE and OFFLINE - scan before move</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-brick">
        <div className="panel-title">Request a transfer</div>
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
          </div>
          <div className="field-row">
            <div className="field">
              <label>Source channel</label>
              <select value={form.source_channel} onChange={(e) => setForm({ ...form, source_channel: e.target.value })}>
                <option value="ONLINE">ONLINE</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
            <div className="field">
              <label>Destination channel</label>
              <select value={form.destination_channel} onChange={(e) => setForm({ ...form, destination_channel: e.target.value })}>
                <option value="ONLINE">ONLINE</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
            <div className="field">
              <label>Reason</label>
              <select value={form.reason_code} onChange={(e) => setForm({ ...form, reason_code: e.target.value })}>
                <option value="LOW_STOCK">Low stock</option>
                <option value="UPSELL_REDIRECT">Upsell redirect</option>
                <option value="CORRECTION">Correction</option>
              </select>
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit transfer'}</button>
          <p style={{ fontSize: 12.5, color: 'var(--text-on-paper-dim)', marginTop: 8 }}>
            Transfers of 200 units or more require Admin approval before physical movement is cleared.
          </p>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Transfer history ({transfers.length})</div>
        {transfers.length === 0 ? (
          <div className="empty-state">No transfers logged yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Product</th><th>Unit</th><th>From → To</th><th>Qty</th><th>Reason</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.created_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{t.product_name}</td>
                  <td className="mono">{t.unit_code}</td>
                  <td>{t.source_channel} → {t.destination_channel}</td>
                  <td className="num">{Number(t.quantity).toFixed(2)}</td>
                  <td>{t.reason_code.replace('_', ' ')}</td>
                  <td><span className={`badge ${t.status === 'CLEARED' ? 'open' : 'pending'}`}>{t.status.replace('_', ' ')}</span></td>
                  <td>{t.status === 'PENDING_APPROVAL' && <button className="btn small ghost" onClick={() => handleApprove(t.id)}>Approve</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
