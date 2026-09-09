import React, { Suspense, lazy, useEffect, useState } from 'react';
import client from '../../shared/api/client.js';
import { queuedRequest } from '../../shared/offline/offlineQueue.js';

// @zxing/browser's decoder is large - only fetch it when someone actually opens the scanner.
const BarcodeScanner = lazy(() => import('../../shared/barcode/BarcodeScanner.jsx'));

const TYPES = [
  { value: 'DELIVERY_RECEIPT', label: 'Delivery receipt' },
  { value: 'BACKLOAD', label: 'Backload' },
  { value: 'UPSELL', label: 'Upsell' },
  { value: 'BAD_ORDER', label: 'Bad order' },
];

export default function Logistics() {
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { message } while awaiting confirm
  const [form, setForm] = useState({ type: 'DELIVERY_RECEIPT', product_id: '', unit_id: '', quantity: '', reference: '' });

  function load() {
    Promise.all([client.get('/api/products'), client.get('/api/logistics')])
      .then(([p, l]) => { setProducts(p.data); setRows(l.data); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  function handleScanned(code) {
    setScanning(false);
    client.get('/api/products/lookup', { params: { barcode: code } })
      .then((r) => {
        const product = r.data;
        setForm((f) => ({
          ...f,
          product_id: product.id,
          unit_id: product.units.length === 1 ? product.units[0].id : '',
        }));
      })
      .catch((e) => setError(e.message));
  }

  async function submit(confirmDuplicate) {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, confirm_duplicate: confirmDuplicate || undefined };
      const result = await queuedRequest('post', '/api/logistics', payload);
      setDuplicateWarning(null);
      setForm((f) => ({ ...f, quantity: '', reference: '' }));
      setNotice(result.queued ? 'Offline - saved locally, will sync automatically.' : '');
      load();
    } catch (err) {
      if (err.code === 'duplicate_reference') {
        setDuplicateWarning({ message: err.response.data.message });
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!form.product_id || !form.unit_id || !form.quantity) {
      setError('Fill in product, unit and quantity.');
      return;
    }
    submit(false);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Offline logistics log</h1>
          <p className="page-subtitle">Delivery receipts, backloads, upsell and bad order - updates OFFLINE stock directly</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="offline-banner">{notice}</div>}

      {scanning && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-card">Loading scanner…</div></div>}>
          <BarcodeScanner onDetected={handleScanned} onClose={() => setScanning(false)} />
        </Suspense>
      )}

      {duplicateWarning && (
        <div className="panel accent-brick">
          <div className="panel-title">Possible duplicate</div>
          <p style={{ fontSize: 13.5 }}>{duplicateWarning.message} Log it anyway?</p>
          <button className="btn" onClick={() => submit(true)} disabled={saving}>Log anyway</button>{' '}
          <button className="btn ghost" onClick={() => setDuplicateWarning(null)}>Cancel</button>
        </div>
      )}

      <div className="panel accent-olive">
        <div className="panel-title">
          Log a transaction
          <button type="button" className="btn small ghost" onClick={() => setScanning(true)}>Scan barcode</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
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
          </div>
          <div className="field-row">
            <div className="field">
              <label>Quantity</label>
              <input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="field">
              <label>Reference (waybill / DR no.)</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Logging…' : 'Log transaction'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Recent transactions ({rows.length})</div>
        {rows.length === 0 ? (
          <div className="empty-state">Nothing logged yet.</div>
        ) : (
          <table>
            <thead><tr><th>Time</th><th>Type</th><th>Product</th><th>Unit</th><th>Qty</th><th>Reference</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.logged_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{TYPES.find((t) => t.value === r.type)?.label || r.type}</td>
                  <td>{r.product_name}</td>
                  <td className="mono">{r.unit_code}</td>
                  <td className="num">{Number(r.quantity).toFixed(2)}</td>
                  <td>{r.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
