import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../shared/api/client.js';

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [fulfillment, setFulfillment] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      client.get('/api/stock-alerts'),
      client.get('/api/fulfillment-daily', { params: { date: today } }),
      client.get('/api/ospr/batches'),
    ])
      .then(([a, f, b]) => {
        setAlerts(a.data);
        setFulfillment(f.data);
        setBatches(b.data.slice(0, 6));
      })
      .catch((e) => setError(e.message));
  }, []);

  const openBatches = batches.filter((b) => b.status === 'OPEN').length;
  const totalOut = fulfillment?.items?.reduce((s, i) => s + Number(i.qty_out), 0) ?? 0;
  const totalRts = fulfillment?.items?.reduce((s, i) => s + Number(i.qty_rts), 0) ?? 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Floor overview</h1>
          <p className="page-subtitle">Production → Packing → Logistics, {today}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Low-stock alerts</div>
          <div className={`value ${alerts.length ? 'brick' : ''}`}>{alerts.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Open OSPR batches</div>
          <div className="value amber">{openBatches}</div>
        </div>
        <div className="stat-card">
          <div className="label">Fulfilled (OUT) today</div>
          <div className="value olive">{totalOut.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">RTS logged today</div>
          <div className="value">{totalRts.toFixed(2)}</div>
        </div>
      </div>

      <div className="panel accent-brick">
        <div className="panel-title">
          Stock alerts <Link to="/transfers" className="btn small ghost">Go to transfer ledger</Link>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state">No product/unit is at or below its low-stock threshold.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Product</th><th>Unit</th><th>Channel</th><th>Balance</th><th>Threshold</th></tr>
            </thead>
            <tbody>
              {alerts.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td>{a.product_name}</td>
                  <td className="mono">{a.unit_code}</td>
                  <td><span className={`badge ${a.channel.toLowerCase()}`}>{a.channel}</span></td>
                  <td className="num">{Number(a.quantity).toFixed(2)}</td>
                  <td className="num">{Number(a.low_stock_threshold).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel accent-amber">
        <div className="panel-title">
          Recent OSPR batches <Link to="/ospr" className="btn small ghost">View all</Link>
        </div>
        {batches.length === 0 ? (
          <div className="empty-state">No OSPR batches yet. Open one from the OSPR Batches page.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Courier</th><th>Status</th><th>Items</th><th></th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.batch_date}</td>
                  <td>{b.courier || '—'}</td>
                  <td><span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span></td>
                  <td className="num">{b.item_count}</td>
                  <td><Link to={`/ospr/${b.id}`} className="btn small ghost">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
