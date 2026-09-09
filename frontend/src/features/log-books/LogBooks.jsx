import React, { useEffect, useState } from 'react';
import client from '../../shared/api/client.js';

export default function LogBooks() {
  const [view, setView] = useState('sku');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/api/log-books', { params: { view } })
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  }, [view]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Dual log book</h1>
          <p className="page-subtitle">Two views over the same transactions</p>
        </div>
        <div className="tabs">
          <button className={'tab' + (view === 'sku' ? ' active' : '')} onClick={() => setView('sku')}>By SKU</button>
          <button className={'tab' + (view === 'packer' ? ' active' : '')} onClick={() => setView('packer')}>By Packer</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        {view === 'sku' ? (
          rows.length === 0 ? <div className="empty-state">No data yet.</div> : (
            <table>
              <thead><tr><th>Product</th><th>Unit</th><th>Total withdrawn</th><th>Total packed</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product_name}</td>
                    <td className="mono">{r.unit_code}</td>
                    <td className="num">{Number(r.total_withdrawn).toFixed(2)}</td>
                    <td className="num">{Number(r.total_packed).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          rows.length === 0 ? <div className="empty-state">No data yet.</div> : (
            <table>
              <thead><tr><th>Packer</th><th>Total withdrawn</th><th>Boxes packed</th><th>Batches packed</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.packer_id}>
                    <td>BY {r.packer_no}</td>
                    <td className="num">{Number(r.total_withdrawn).toFixed(2)}</td>
                    <td className="num">{r.total_boxes_packed}</td>
                    <td className="num">{r.batches_packed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
