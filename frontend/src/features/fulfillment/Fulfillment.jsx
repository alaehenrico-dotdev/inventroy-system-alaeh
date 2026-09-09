import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function Fulfillment() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load(d) {
    client.get('/api/fulfillment-daily', { params: { date: d } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }
  useEffect(() => load(date), [date]);

  async function handlePersist() {
    setSaving(true);
    setError('');
    try {
      await client.post('/api/fulfillment-daily', { date });
      load(date);
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
          <h1 className="page-title">Daily fulfillment summary</h1>
          <p className="page-subtitle">Fulfillment (OUT) vs RTS per product/unit, mirroring the paper sheet</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="label">Total parcel</div><div className="value amber">{data.total_parcel}</div></div>
            <div className="stat-card"><div className="label">Total packers</div><div className="value">{data.total_packers}</div></div>
          </div>

          <div className="panel">
            <div className="panel-title">
              Per-product rollup
              <button className="btn small ghost" onClick={handlePersist} disabled={saving}>
                {saving ? 'Saving…' : 'Save snapshot for this date'}
              </button>
            </div>
            {data.items.length === 0 ? (
              <div className="empty-state">No packed orders or returns recorded for this date yet.</div>
            ) : (
              <table>
                <thead><tr><th>Product</th><th>Unit</th><th>Fulfillment (OUT)</th><th>RTS</th></tr></thead>
                <tbody>
                  {data.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.product_name}</td>
                      <td className="mono">{it.unit_code}</td>
                      <td className="num">{Number(it.qty_out).toFixed(2)}</td>
                      <td className="num">{Number(it.qty_rts).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
