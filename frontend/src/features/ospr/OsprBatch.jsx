import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../../shared/api/client.js';

export default function OsprBatch() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [products, setProducts] = useState([]);
  const [packers, setPackers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [itemForm, setItemForm] = useState({ code_name: '', product_id: '', unit_id: '', quantity: 1, customer_name: '' });
  const [closeForm, setCloseForm] = useState({ packed_by: '', boxes: {} });

  function load() {
    Promise.all([
      client.get('/api/ospr/batches', { params: { id } }),
      client.get('/api/products'),
      client.get('/api/packers'),
    ]).then(([b, p, pk]) => { setBatch(b.data); setProducts(p.data); setPackers(pk.data); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  const selectedProduct = products.find((p) => String(p.id) === String(itemForm.product_id));
  const isOpen = batch?.status === 'OPEN';

  async function handleAddItem(e) {
    e.preventDefault();
    setError('');
    if (!itemForm.code_name || !itemForm.product_id || !itemForm.unit_id) {
      setError('Give the order a code name, product and unit.');
      return;
    }
    setSaving(true);
    try {
      await client.post('/api/ospr/items', { ...itemForm, batch_id: id });
      setItemForm({ code_name: '', product_id: '', unit_id: '', quantity: 1, customer_name: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId) {
    try {
      await client.delete('/api/ospr/items', { data: { id: itemId } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const boxes_used = Object.entries(closeForm.boxes)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([packer_id, box_count]) => ({ packer_id, box_count }));
      await client.post('/api/ospr/close', {
        batch_id: id,
        packed_by: closeForm.packed_by || null,
        boxes_used,
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!batch) return <div className="empty-state">Loading batch…</div>;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">OSPR — {batch.batch_date}</h1>
          <p className="page-subtitle">
            <Link to="/ospr">← All batches</Link> · Courier {batch.courier || '—'} · Prepared by {batch.prepared_by || '—'}
          </p>
        </div>
        <span className={`badge ${batch.status.toLowerCase()}`}>{batch.status}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isOpen && (
        <div className="panel accent-amber">
          <div className="panel-title">Scan / add an order</div>
          <form onSubmit={handleAddItem}>
            <div className="field-row">
              <div className="field">
                <label>Code name (buyer handle)</label>
                <input value={itemForm.code_name} onChange={(e) => setItemForm({ ...itemForm, code_name: e.target.value })} placeholder="e.g. lynlea88" />
              </div>
              <div className="field">
                <label>Customer's name</label>
                <input value={itemForm.customer_name} onChange={(e) => setItemForm({ ...itemForm, customer_name: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Variant / product</label>
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
            <button className="btn primary" disabled={saving}>{saving ? 'Adding…' : 'Add order row'}</button>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Order rows ({batch.items.length})</div>
        {batch.items.length === 0 ? (
          <div className="empty-state">No orders scanned onto this batch yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>No.</th><th>Code name</th><th>Variant</th><th>Unit</th><th>Qty</th><th>Customer's name</th>{isOpen && <th></th>}</tr>
            </thead>
            <tbody>
              {batch.items.map((it) => (
                <tr key={it.id}>
                  <td className="mono">{it.seq_no}</td>
                  <td>{it.code_name}</td>
                  <td>{it.product_name}</td>
                  <td className="mono">{it.unit_code}</td>
                  <td className="num">{Number(it.quantity).toFixed(2)}</td>
                  <td>{it.customer_name || '—'}</td>
                  {isOpen && <td><button className="btn small ghost" onClick={() => handleDeleteItem(it.id)}>Remove</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isOpen ? (
        <div className="panel accent-olive">
          <div className="panel-title">Close batch</div>
          <form onSubmit={handleClose}>
            <div className="field">
              <label>Packed by</label>
              <select value={closeForm.packed_by} onChange={(e) => setCloseForm({ ...closeForm, packed_by: e.target.value })}>
                <option value="">Select packer…</option>
                {packers.map((p) => <option key={p.id} value={p.id}>BY {p.packer_no}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Boxes used per active packer</label>
              <div className="field-row">
                {packers.map((p) => (
                  <div key={p.id} className="field" style={{ marginBottom: 0 }}>
                    <label>BY {p.packer_no}</label>
                    <input
                      type="number" min="0"
                      value={closeForm.boxes[p.id] ?? ''}
                      onChange={(e) => setCloseForm({ ...closeForm, boxes: { ...closeForm.boxes, [p.id]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button className="btn primary" disabled={saving}>{saving ? 'Closing…' : 'Close batch & compute Accomplishment Report'}</button>
          </form>
        </div>
      ) : (
        <div className="panel accent-olive">
          <div className="panel-title">Accomplishment Report</div>
          {batch.accomplishment ? (
            <>
              <div className="stat-grid">
                <div className="stat-card"><div className="label">Total PCS of Parcel</div><div className="value">{batch.accomplishment.total_pcs_parcel}</div></div>
                <div className="stat-card"><div className="label">Total Parcel Packed</div><div className="value">{batch.accomplishment.total_parcel_packed}</div></div>
              </div>
              <table>
                <thead><tr><th>Gallon</th><th>Liter</th><th>750ML</th><th>350ML</th><th>1KG Retail Salt</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="num">{Number(batch.accomplishment.qty_gal).toFixed(2)}</td>
                    <td className="num">{Number(batch.accomplishment.qty_lit).toFixed(2)}</td>
                    <td className="num">{Number(batch.accomplishment.qty_750).toFixed(2)}</td>
                    <td className="num">{Number(batch.accomplishment.qty_350).toFixed(2)}</td>
                    <td className="num">{Number(batch.accomplishment.qty_1kg_salt).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="panel-title" style={{ marginTop: 18 }}>Total of boxes used</div>
              <table>
                <thead><tr><th>Packer</th><th>Boxes</th></tr></thead>
                <tbody>
                  {batch.boxes_used.map((b) => (
                    <tr key={b.id}><td>BY {b.packer_no}</td><td className="num">{b.box_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <div className="empty-state">Not computed.</div>}
        </div>
      )}
    </div>
  );
}
