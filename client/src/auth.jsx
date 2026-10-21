import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { useI18n } from './i18n.jsx';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [state, setState] = useState({ loading: Boolean(getToken()), user: null, tenant: null });

  const apply = useCallback((data) => {
    setState({ loading: false, user: data.user, tenant: data.tenant });
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me').then(apply).catch(() => setState({ loading: false, user: null, tenant: null }));
  }, [apply]);

  useEffect(() => {
    const onLogout = () => setState({ loading: false, user: null, tenant: null });
    window.addEventListener('vsk:logout', onLogout);
    return () => window.removeEventListener('vsk:logout', onLogout);
  }, []);

  const login = useCallback(async (mobile, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { mobile, password } });
    setToken(data.token);
    if (data.user.language) setLang(data.user.language);
    apply(data);
  }, [apply, setLang]);

  const register = useCallback(async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form });
    setToken(data.token);
    apply(data);
  }, [apply]);

  const logout = useCallback(() => {
    setToken(null);
    setState({ loading: false, user: null, tenant: null });
  }, []);

  const value = useMemo(() => ({
    ...state, login, register, logout,
    isOwner: state.user?.role === 'owner',
    canWrite: state.user && state.user.role !== 'readonly',
    setTenant: (tenant) => setState((s) => ({ ...s, tenant })),
  }), [state, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
