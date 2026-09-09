import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/auth/AuthContext.jsx';
import Layout from './Layout.jsx';
import Login from '../features/auth/Login.jsx';
import Dashboard from '../features/dashboard/Dashboard.jsx';
import Products from '../features/products/Products.jsx';
import Withdrawals from '../features/withdrawals/Withdrawals.jsx';
import OsprList from '../features/ospr/OsprList.jsx';
import OsprBatch from '../features/ospr/OsprBatch.jsx';
import Transfers from '../features/transfers/Transfers.jsx';
import Rts from '../features/rts/Rts.jsx';
import Logistics from '../features/logistics/Logistics.jsx';
import ReceiptList from '../features/logistics/ReceiptList.jsx';
import ReceiptDetail from '../features/logistics/ReceiptDetail.jsx';
import Fulfillment from '../features/fulfillment/Fulfillment.jsx';
import LogBooks from '../features/log-books/LogBooks.jsx';
import AuditTrail from '../features/audit-trail/AuditTrail.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell() {
  return (
    <RequireAuth>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/withdrawals" element={<Withdrawals />} />
          <Route path="/ospr" element={<OsprList />} />
          <Route path="/ospr/:id" element={<OsprBatch />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/rts" element={<Rts />} />
          <Route path="/logistics" element={<Logistics />} />
          <Route path="/logistics/receipts" element={<ReceiptList />} />
          <Route path="/logistics/receipts/:id" element={<ReceiptDetail />} />
          <Route path="/fulfillment" element={<Fulfillment />} />
          <Route path="/log-books" element={<LogBooks />} />
          <Route path="/audit-trail" element={<AuditTrail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </AuthProvider>
  );
}
