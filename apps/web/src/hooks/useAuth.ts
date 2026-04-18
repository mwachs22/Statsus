import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

export function useAuth() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    api.auth
      .me()
      .then(({ user }) => {
        setUser(user);
        // Re-issue a fresh 24h token on every app boot so active sessions
        // stay alive without requiring a manual re-login.
        api.auth.refresh().catch(() => { /* ignore — session stays valid until expiry */ });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [initialized, setUser]);

  const login = async (email: string, password: string) => {
    const { user } = await api.auth.login(email, password);
    setUser(user);
  };

  const register = async (email: string, password: string) => {
    const { user } = await api.auth.register(email, password);
    setUser(user);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    // Clear persisted store
    useAuthStore.persist.clearStorage();
  };

  return { user, loading, login, register, logout };
}
