import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext.jsx';
import { subscribe } from '../shared/offline/offlineQueue.js';
import LogoMark from '../shared/brand/LogoMark.jsx';

const NAV_GROUPS = [
  {
    label: 'Overview',
    links: [{ to: '/', label: 'Dashboard' }],
  },
  {
    label: 'Production',
    links: [{ to: '/withdrawals', label: 'Withdrawals' }],
  },
  {
    label: 'Packing (Online)',
    links: [
      { to: '/ospr', label: 'OSPR Batches' },
      { to: '/pack-logs', label: 'Packing Quota' },
      { to: '/rts', label: 'RTS Triage' },
    ],
  },
  {
    label: 'Logistics (Offline)',
    links: [
      { to: '/logistics', label: 'Logistics Log' },
      { to: '/logistics/receipts', label: 'Delivery Receipts' },
    ],
  },
  {
    label: 'Admin / Supervisor',
    links: [
      { to: '/products', label: 'Product Catalog' },
      { to: '/transfers', label: 'Transfer Ledger' },
      { to: '/fulfillment', label: 'Fulfillment Summary' },
      { to: '/log-books', label: 'Log Books' },
      { to: '/audit-trail', label: 'Audit Trail' },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [queueState, setQueueState] = useState({ pending: [], failed: [] });

  useEffect(() => subscribe(setQueueState), []);

  return (
    <>
      {queueState.pending.length > 0 && (
        <div className="offline-banner">
          Offline — {queueState.pending.length} logistics {queueState.pending.length === 1 ? 'change' : 'changes'} queued, will sync automatically.
        </div>
      )}
      {queueState.failed.length > 0 && (
        <div className="offline-banner" style={{ borderColor: 'var(--brick)', color: 'var(--brick-deep)', background: 'rgba(156,74,58,0.12)' }}>
          {queueState.failed.length} queued logistics {queueState.failed.length === 1 ? 'change' : 'changes'} failed to sync — check the Logistics pages and re-enter if needed.
        </div>
      )}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <LogoMark size={44} />
            <div>
              <span className="plant">LODLOD, LIPA CITY</span>
              <span className="name">Inventory &amp; Monitoring</span>
            </div>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <strong>{user?.name}</strong>
              {user?.role}{user?.packer_no ? ` · Packer ${user.packer_no}` : ''}
            </div>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  );
}
