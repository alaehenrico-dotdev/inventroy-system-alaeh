import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../shared/api/client.js';
import { queuedRequest } from '../../shared/offline/offlineQueue.js';

export default function ReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [form, setForm] = useState({ reference: '', supplier: '', received_by: '' });

  function load() {
    client.get('/api/logistics/receipts').then((r) => setReceipts(r.data)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function submit(confirmDuplicate) {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, confirm_duplicate: confirmDuplicate || undefined };
      const result = await queuedRequest('post', '/api/logistics/receipts', payload);
      setDuplicateWarning(null);
      setForm({ reference: '', supplier: '', received_by: '' });
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

  async function handleOpen(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!form.reference) {
      setError('Give the receipt a reference (waybill / DR no.).');
      return;
    }
    submit(false);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Delivery receipts</h1>
          <p className="page-subtitle">Open one per waybill, scan every SKU on it, then close - instead of one row at a time</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="offline-banner">{notice}</div>}

      {duplicateWarning && (
        <div className="panel accent-brick">
          <div className="panel-title">Possible duplicate</div>
          <p style={{ fontSize: 13.5 }}>{duplicateWarning.message} Open it anyway?</p>
          <button className="btn" onClick={() => submit(true)} disabled={saving}>Open anyway</button>{' '}
          <button className="btn ghost" onClick={() => setDuplicateWarning(null)}>Cancel</button>
        </div>
      )}

      <div className="panel accent-amber">
        <div className="panel-title">Open a new delivery receipt</div>
        <form onSubmit={handleOpen}>
          <div className="field-row">
            <div className="field">
              <label>Reference (waybill / DR no.)</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="field">
              <label>Supplier</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div className="field">
              <label>Received by</label>
              <input value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })} />
            </div>
          </div>
          <button className="btn primary" disabled={saving}>{saving ? 'Opening…' : 'Open receipt'}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">All receipts ({receipts.length})</div>
        {receipts.length === 0 ? (
          <div className="empty-state">No delivery receipts yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Opened</th><th>Reference</th><th>Supplier</th><th>Received by</th><th>Status</th><th>Lines</th><th></th></tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.opened_at.slice(0, 16).replace('T', ' ')}</td>
                  <td className="mono">{r.reference}</td>
                  <td>{r.supplier || '—'}</td>
                  <td>{r.received_by || '—'}</td>
                  <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                  <td className="num">{r.item_count}</td>
                  <td><Link to={`/logistics/receipts/${r.id}`} className="btn small ghost">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
