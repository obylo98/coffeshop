'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import AuthModal from './AuthModal';
import Icon from './Icon';

const DirectionsModal = dynamic(() => import('./DirectionsModal'), { ssr: false });

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

const SETTINGS_KEY = 'roastroute:settings';
const CENTER_KEY = 'roastroute:center';

const safeGet = (store, key) => {
  try {
    return JSON.parse(window[store].getItem(key) || 'null');
  } catch {
    return null;
  }
};
const safeSet = (store, key, value) => {
  try {
    window[store].setItem(key, JSON.stringify(value));
  } catch {}
};

export default function Providers({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [center, setCenterState] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'register'
  const [directionsTo, setDirectionsTo] = useState(null);
  const setAuthOpen = useCallback((open) => setAuthMode(open ? 'login' : null), []);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;

  // ── Toasts ──
  const toast = useCallback((message, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ── In-app confirm dialog (never window.confirm) ──
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  );

  // ── Settings belong to the account. The browser copy is only a cache so the
  //    theme doesn't flash on reload; logged-out visitors get the defaults. ──
  const applySettings = useCallback((s, { cache = true } = {}) => {
    const next = { ...DEFAULT_SETTINGS, ...(s || {}) };
    setSettings(next);
    if (cache) safeSet('localStorage', SETTINGS_KEY, next);
    else
      try {
        window.localStorage.removeItem(SETTINGS_KEY);
      } catch {}
    document.documentElement.dataset.theme = next.theme;
    return next;
  }, []);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSettings = useCallback(
    async (patch) => {
      // Logged out: apply for this visit only (e.g. the map-style switcher); nothing is saved.
      const next = applySettings({ ...settingsRef.current, ...patch }, { cache: Boolean(userRef.current) });
      settingsRef.current = next;
      if (userRef.current) {
        try {
          const d = await api('/api/settings', { method: 'PUT', body: JSON.stringify(next) });
          applySettings(d.settings);
        } catch (e) {
          toast(`Couldn't save preferences: ${e.message}`, 'error');
        }
      }
      return next;
    },
    [applySettings, toast],
  );

  // ── Shared search location ──
  const setCenter = useCallback((c) => {
    setCenterState(c);
    safeSet('sessionStorage', CENTER_KEY, c);
  }, []);

  // ── Boot: restore local settings + session ──
  useEffect(() => {
    applySettings(safeGet('localStorage', SETTINGS_KEY));
    const c = safeGet('sessionStorage', CENTER_KEY);
    if (c) setCenterState(c);
    api('/api/auth/me')
      .then((d) => {
        setUser(d.user);
        setFavorites(d.favorites || []);
        if (d.user) applySettings(d.settings);
        else applySettings(null, { cache: false });
      })
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, [applySettings]);

  const onAuthed = useCallback(
    async (d) => {
      setUser(d.user);
      setFavorites(d.favorites || []);
      setAuthOpen(false);
      applySettings(d.settings); // null for a brand-new account → defaults
      toast(d.isNew ? `Account created — welcome, ${d.user.username}!` : `Welcome back, ${d.user.username}`);
    },
    [applySettings, toast],
  );

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setFavorites([]);
    applySettings(null, { cache: false });
    toast('Logged out');
  }, [toast, applySettings]);

  // Run an action that needs an account; opens the login modal otherwise.
  const withAuth = useCallback(
    async (fn) => {
      if (!userRef.current) {
        setAuthOpen(true);
        return null;
      }
      try {
        return await fn();
      } catch (e) {
        if (e.status === 401) {
          setUser(null);
          setAuthOpen(true);
        }
        toast(e.message, 'error');
        return null;
      }
    },
    [toast],
  );

  // ── Favourites ──
  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const isFavorite = useCallback((id) => favIds.has(id), [favIds]);
  const getFavorite = useCallback((id) => favorites.find((f) => f.id === id) || null, [favorites]);

  const saveFavorite = useCallback(
    (shop) =>
      withAuth(async () => {
        const d = await api('/api/favorites', { method: 'POST', body: JSON.stringify(shop) });
        setFavorites(d.favorites);
        toast(`Saved ${shop.name || 'spot'} to favourites`);
        return d.saved;
      }),
    [withAuth, toast],
  );

  const removeFavorite = useCallback(
    (id) =>
      withAuth(async () => {
        const d = await api(`/api/favorites?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setFavorites(d.favorites);
        toast('Removed from favourites');
        return true;
      }),
    [withAuth, toast],
  );

  const toggleFavorite = useCallback(
    (shop) => (favIds.has(shop.id) ? removeFavorite(shop.id) : saveFavorite(shop)),
    [favIds, removeFavorite, saveFavorite],
  );

  const updateFavorite = useCallback(
    (id, patch) =>
      withAuth(async () => {
        const d = await api('/api/favorites', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
        setFavorites(d.favorites);
        toast('Note saved');
        return true;
      }),
    [withAuth, toast],
  );

  const saveCupping = useCallback(
    (favId, entry) =>
      withAuth(async () => {
        const d = await api('/api/favorites/cupping', { method: 'POST', body: JSON.stringify({ favId, entry }) });
        setFavorites(d.favorites);
        toast('Cupping note saved to your log');
        return true;
      }),
    [withAuth, toast],
  );

  const deleteCupping = useCallback(
    (favId, entryId) =>
      withAuth(async () => {
        const d = await api(
          `/api/favorites/cupping?favId=${encodeURIComponent(favId)}&entryId=${encodeURIComponent(entryId)}`,
          { method: 'DELETE' },
        );
        setFavorites(d.favorites);
        toast('Cupping note deleted');
        return true;
      }),
    [withAuth, toast],
  );

  const importFavorites = useCallback(
    (list) =>
      withAuth(async () => {
        const d = await api('/api/favorites/import', { method: 'POST', body: JSON.stringify({ favorites: list }) });
        setFavorites(d.favorites);
        toast(`Imported backup: ${d.added} added, ${d.updated} updated${d.skipped ? `, ${d.skipped} skipped` : ''}`);
        return d;
      }),
    [withAuth, toast],
  );

  const clearFavorites = useCallback(
    () =>
      withAuth(async () => {
        const d = await api('/api/favorites?all=1', { method: 'DELETE' });
        setFavorites(d.favorites);
        toast('All saved favourites cleared');
        return true;
      }),
    [withAuth, toast],
  );

  const exportFavorites = useCallback(
    (list = favorites, filename = 'roastroute-favourites.json') => {
      const blob = new Blob(
        [JSON.stringify({ app: 'RoastRoute', exportedAt: new Date().toISOString(), favorites: list }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Exported ${list.length} favourite${list.length === 1 ? '' : 's'}`);
    },
    [favorites, toast],
  );

  const value = {
    user, authReady, logout,
    openAuth: (mode = 'login') => setAuthMode(mode === 'register' ? 'register' : 'login'),
    openDirections: (dest) => setDirectionsTo(dest),
    favorites, isFavorite, getFavorite, saveFavorite, removeFavorite, toggleFavorite, updateFavorite,
    saveCupping, deleteCupping, importFavorites, clearFavorites, exportFavorites,
    settings, updateSettings, resetSettings: () => updateSettings(DEFAULT_SETTINGS),
    center, setCenter, toast, confirm,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {authMode && <AuthModal key={authMode} initialMode={authMode} onClose={() => setAuthMode(null)} onAuthed={onAuthed} />}
      {directionsTo && <DirectionsModal dest={directionsTo} onClose={() => setDirectionsTo(null)} />}
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onDone={(ok) => {
            confirmState.resolve(ok);
            setConfirmState(null);
          }}
        />
      )}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[3000] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl font-label-md text-label-md ${
              t.kind === 'error' ? 'bg-error-container text-on-error-container' : 'bg-inverse-surface text-inverse-on-surface'
            }`}
          >
            <Icon name={t.kind === 'error' ? 'error' : 'check_circle'} className="text-base" />
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

function ConfirmDialog({ title, body, confirmLabel = 'Confirm', danger, onDone }) {
  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4" onClick={() => onDone(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-lg shadow-2xl space-y-space-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-headline-sm text-headline-sm text-primary">{title}</h3>
        {body && <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>}
        <div className="flex justify-end gap-space-sm pt-space-xs">
          <button className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container" onClick={() => onDone(false)}>
            Cancel
          </button>
          <button
            autoFocus
            className={`px-5 py-2 rounded-full font-label-md text-label-md shadow-sm ${
              danger ? 'bg-error text-on-error' : 'bg-primary-container text-on-primary'
            }`}
            onClick={() => onDone(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
