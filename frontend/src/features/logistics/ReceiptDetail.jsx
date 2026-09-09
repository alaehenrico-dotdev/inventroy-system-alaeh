import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../../shared/api/client.js';
import { queuedRequest } from '../../shared/offline/offlineQueue.js';

// @zxing/browser's decoder is large - only fetch it when someone actually opens the scanner.
const BarcodeScanner = lazy(() => import('../../shared/barcode/BarcodeScanner.jsx'));

export default function ReceiptDetail() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [itemForm, setItemForm] = useState({ product_id: '', unit_id: '', quantity: 1 });

  function load() {
    Promise.all([
      client.get('/api/logistics/receipts', { params: { id } }),
      client.get('/api/products'),
    ]).then(([r, p]) => { setReceipt(r.data); setProducts(p.data); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  const selectedProduct = products.find((p) => String(p.id) === String(itemForm.product_id));
  const isOpen = receipt?.status === 'OPEN';

  function handleScanned(code) {
    setScanning(false);
    client.get('/api/products/lookup', { params: { barcode: code } })
      .then((r) => {
        const product = r.data;
        setItemForm((f) => ({
          ...f,
          product_id: product.id,
          unit_id: product.units.length === 1 ? product.units[0].id : '',
        }));
      })
      .catch((e) => setError(e.message));
  }

  async function handleAddItem(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!itemForm.product_id || !itemForm.unit_id) {
      setError('Select a product and unit.');
      return;
    }
    setSaving(true);
    try {
      const result = await queuedRequest('post', '/api/logistics/receipts/items', { ...itemForm, receipt_id: id });
      setItemForm({ product_id: '', unit_id: '', quantity: 1 });
      setNotice(result.queued ? 'Offline - line saved locally, will sync automatically.' : '');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId) {
    setError('');
    setNotice('');
    try {
      const result = await queuedRequest('delete', '/api/logistics/receipts/items', { id: itemId });
      setNotice(result.queued ? 'Offline - removal saved locally, will sync automatically.' : '');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClose() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await queuedRequest('post', '/api/logistics/receipts/close', { receipt_id: id });
      setNotice(result.queued ? 'Offline - close saved locally, will sync automatically.' : '');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!receipt) return <div className="empty-state">Loading receipt…</div>;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Receipt — {receipt.reference}</h1>
          <p className="page-subtitle">
            <Link to="/logistics/receipts">← All receipts</Link> · Supplier {receipt.supplier || '—'} · Received by {receipt.received_by || '—'}
          </p>
        </div>
        <span className={`badge ${receipt.status.toLowerCase()}`}>{receipt.status}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="offline-banner">{notice}</div>}

      {scanning && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-card">Loading scanner…</div></div>}>
          <BarcodeScanner onDetected={handleScanned} onClose={() => setScanning(false)} />
        </Suspense>
      )}

      {isOpen && (
        <div className="panel accent-amber">
          <div className="panel-title">
            Scan / add a line
            <button type="button" className="btn small ghost" onClick={() => setScanning(true)}>Scan barcode</button>
          </div>
          <form onSubmit={handleAddItem}>
            <div className="field-row">
              <div className="field">
                <label>Product</label>
                <select value={itemForm.product_id} onChange={(e) => setItemForm({ ...itemForm, product_id: e.target.value, unit_id: '' })}>
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Unit</label>
                <select value={itemForm.unit_id} onChange={(e) => setItemForm({ ...itemForm, unit_id: e.target.value })} disabled={!selectedProduct}>
                  <option value="">Select unit…</option>
                  {selectedProduct?.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input type="number" step="0.01" min="0" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
              </div>
            </div>
            <button className="btn primary" disabled={saving}>{saving ? 'Adding…' : 'Add line'}</button>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Lines ({receipt.items.length})</div>
        {receipt.items.length === 0 ? (
          <div className="empty-state">No SKUs scanned onto this receipt yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Product</th><th>Unit</th><th>Qty</th>{isOpen && <th></th>}</tr>
            </thead>
            <tbody>
              {receipt.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.product_name}</td>
                  <td className="mono">{it.unit_code}</td>
                  <td className="num">{Number(it.quantity).toFixed(2)}</td>
                  {isOpen && <td><button className="btn small ghost" onClick={() => handleDeleteItem(it.id)}>Remove</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isOpen && (
        <div className="panel accent-olive">
          <div className="panel-title">Close receipt</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-on-paper-dim)' }}>
            Closing locks the receipt - lines can no longer be added or removed.
          </p>
          <button className="btn primary" onClick={handleClose} disabled={saving}>{saving ? 'Closing…' : 'Close receipt'}</button>
        </div>
      )}
    </div>
  );
}
