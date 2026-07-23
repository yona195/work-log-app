import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, TOKEN_KEY } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authRequired, setAuthRequired] = useState(null); // null = unknown
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  // Ask the server whether login is needed at all.
  useEffect(() => {
    let cancelled = false;
    authApi
      .status()
      .then((res) => {
        if (!cancelled) setAuthRequired(Boolean(res.authRequired));
      })
      .catch(() => {
        // If the status check fails, assume auth is required so we don't
        // accidentally expose the app; the login attempt will surface errors.
        if (!cancelled) setAuthRequired(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A fresh password login already records the "previous login" rolling
  // timestamp server-side (see POST /login) — but resuming a session from
  // a token already in storage (returning user, no password re-entered)
  // never hit that code path, so the timestamp stayed stuck at whatever it
  // was the last time someone actually typed a password. Runs once per app
  // load, using whichever token was already present at mount — a token set
  // moments later by login() is intentionally not re-triggered here.
  useEffect(() => {
    if (!token) return;
    authApi.resumeSession().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    authApi.logout().catch(() => {});
  }, []);

  // A 401 from any data request forces logout.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  const login = useCallback(async (password) => {
    const res = await authApi.login(password);
    if (res.token) {
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
    }
    return res;
  }, []);

  const isAuthenticated = authRequired === false || Boolean(token);

  const value = {
    ready: authRequired !== null,
    authRequired,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
