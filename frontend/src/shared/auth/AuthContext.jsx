import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('ala_eh_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('ala_eh_user', JSON.stringify(user));
    else localStorage.removeItem('ala_eh_user');
  }, [user]);

  async function login(username, password) {
    const res = await client.post('/api/login', { username, password });
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
