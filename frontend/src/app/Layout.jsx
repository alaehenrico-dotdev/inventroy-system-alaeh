import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext.jsx';

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
      { to: '/rts', label: 'RTS Triage' },
    ],
  },
  {
    label: 'Logistics (Offline)',
    links: [{ to: '/logistics', label: 'Logistics Log' }],
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="plant">ALA EH! · LODLOD, LIPA CITY</span>
          <span className="name">Inventory &amp; Monitoring</span>
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
  );
}
