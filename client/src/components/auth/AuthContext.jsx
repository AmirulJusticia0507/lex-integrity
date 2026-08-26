import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../layout/LoadingScreen';

const AuthContext = createContext();

const TOKEN_KEY = 'lex_auth_token';
const USER_KEY = 'lex_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        clearAuth();
      }
    }
    setLoading(false);
  }, []);

  const setAuth = useCallback(
    (tokenValue, userValue) => {
      localStorage.setItem(TOKEN_KEY, tokenValue);
      localStorage.setItem(USER_KEY, JSON.stringify(userValue));
      setToken(tokenValue);
      setUser(userValue);
    },
    [setToken, setUser]
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }) {
  const { user, loading, clearAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }, [loading, user, clearAuth, navigate]);

  if (loading) {
    return <LoadingScreen label="Memeriksa sesi..." />;
  }

  if (!user) {
    return null;
  }

  return children;
}
