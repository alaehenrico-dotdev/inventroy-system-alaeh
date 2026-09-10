import React, { useEffect, useRef, useState } from 'react';
import client from '../../shared/api/client.js';

const emptyForm = { name: '', sku: '', category: 'CONDIMENT', barcode: '', unit_ids: [] };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

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
    if (!form.name || !form.sku || form.unit_ids.length === 0) {
      setError('Give the product a name, a SKU, and at least one unit.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await client.post('/api/products', { ...form, barcode: form.barcode || null });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      barcode: p.barcode || '',
      existingUnitIds: p.units.map((u) => u.id),
      add_unit_ids: [],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  function toggleAddUnit(id) {
    setEditForm((f) => ({
      ...f,
      add_unit_ids: f.add_unit_ids.includes(id) ? f.add_unit_ids.filter((u) => u !== id) : [...f.add_unit_ids, id],
    }));
  }

  async function saveEdit(id) {
    if (!editForm.name || !editForm.sku) {
      setError('Name and SKU cannot be blank.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await client.put('/api/products', {
        id,
        name: editForm.name,
        sku: editForm.sku,
        category: editForm.category,
        barcode: editForm.barcode || null,
        add_unit_ids: editForm.add_unit_ids,
      });
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setError('');
    try {
      const res = await client.get('/api/products/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const csv = await file.text();
      const res = await client.post('/api/products/import', { csv });
      setImportResult(res.data);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Product catalog</h1>
          <p className="page-subtitle">~29 condiment &amp; retail items - each flagged for the units it carries</p>
        </div>
        <div className="tabs">
          <button className="tab" onClick={handleExport}>Export CSV</button>
          <button className="tab" onClick={handleImportClick} disabled={importing}>
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {importResult && (
        <div className="panel accent-olive">
          <div className="panel-title">Import result</div>
          <p>{importResult.created} created, {importResult.updated} updated{importResult.errors.length > 0 ? `, ${importResult.errors.length} row issue(s)` : ''}.</p>
          {importResult.errors.length > 0 && (
            <ul>
              {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
            </ul>
          )}
          <button className="btn" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      <div className="panel accent-amber">
        <div className="panel-title">Add a product</div>
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Product name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>SKU</label>
              <input
                className="mono"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. AE-0030"
              />
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
            <tr><th>#</th><th>Product</th><th>SKU</th><th>Category</th><th>Barcode</th><th>Units</th><th /></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              editingId === p.id ? (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                  <td>
                    <input
                      className="mono"
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    />
                  </td>
                  <td>
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                      <option value="CONDIMENT">Condiment</option>
                      <option value="RETAIL_DRY_GOODS">Retail dry goods</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="mono"
                      value={editForm.barcode}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    />
                  </td>
                  <td className="mono">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {units.map((u) => {
                        const already = editForm.existingUnitIds.includes(u.id);
                        return (
                          <button
                            type="button"
                            key={u.id}
                            title={already ? 'Already carried - units can only be added, not removed, here' : 'Add this unit'}
                            className={'tab' + (already || editForm.add_unit_ids.includes(u.id) ? ' active' : '')}
                            disabled={already}
                            onClick={() => toggleAddUnit(u.id)}
                          >
                            {u.code}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <button className="btn primary" disabled={saving} onClick={() => saveEdit(p.id)}>Save</button>
                    <button className="btn" onClick={cancelEdit}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td>{p.category === 'RETAIL_DRY_GOODS' ? 'Retail dry goods' : 'Condiment'}</td>
                  <td className="mono">{p.barcode || '—'}</td>
                  <td className="mono">{p.units.map((u) => u.code).join(', ')}</td>
                  <td><button className="btn" onClick={() => startEdit(p)}>Edit</button></td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
