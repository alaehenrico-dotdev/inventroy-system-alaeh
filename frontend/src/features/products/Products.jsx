import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', category: 'CONDIMENT', barcode: '', unit_ids: [] });
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([client.get('/api/products'), client.get('/api/units')])
      .then(([p, u]) => { setProducts(p.data); setUnits(u.data); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function toggleUnit(id) {
    setForm((f) => ({
      ...f,
      unit_ids: f.unit_ids.includes(id) ? f.unit_ids.filter((u) => u !== id) : [...f.unit_ids, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || form.unit_ids.length === 0) {
      setError('Give the product a name and at least one unit.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await client.post('/api/products', { ...form, barcode: form.barcode || null });
      setForm({ name: '', category: 'CONDIMENT', barcode: '', unit_ids: [] });
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
          <h1 className="page-title">Product catalog</h1>
          <p className="page-subtitle">~29 condiment &amp; retail items - each flagged for the units it carries</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel accent-amber">
        <div className="panel-title">Add a product</div>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Product name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="CONDIMENT">Condiment</option>
                <option value="RETAIL_DRY_GOODS">Retail dry goods</option>
              </select>
            </div>
            <div className="field">
              <label>Barcode (optional)</label>
              <input
                className="mono"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="Scan or type the barcode value"
              />
            </div>
          </div>
          <div className="field">
            <label>Units carried</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {units.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  className={'tab' + (form.unit_ids.includes(u.id) ? ' active' : '')}
                  onClick={() => toggleUnit(u.id)}
                >
                  {u.code}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Add product'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">Catalog ({products.length})</div>
        <table>
          <thead>
            <tr><th>#</th><th>Product</th><th>Category</th><th>Barcode</th><th>Units</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.id}</td>
                <td>{p.name}</td>
                <td>{p.category === 'RETAIL_DRY_GOODS' ? 'Retail dry goods' : 'Condiment'}</td>
                <td className="mono">{p.barcode || '—'}</td>
                <td className="mono">{p.units.map((u) => u.code).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
