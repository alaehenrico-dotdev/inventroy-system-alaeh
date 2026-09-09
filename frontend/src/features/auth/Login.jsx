import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext.jsx';
import LogoMark from '../../shared/brand/LogoMark.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <LogoMark size={64} />
          <div>
            <div className="login-plant">LODLOD, LIPA CITY</div>
            <h1 className="login-title">Inventory &amp; Monitoring</h1>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text-on-paper-dim)', marginTop: 16 }}>
          Default admin: run <span className="mono">backend/seed_admin.php</span> once after
          importing the database, then sign in with <span className="mono">admin / admin123</span>.
        </p>
      </div>
    </div>
  );
}
