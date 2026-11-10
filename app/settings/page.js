'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, useApp } from '@/components/Providers';
import Icon from '@/components/Icon';
import { formatDistance, METRES_PER_MILE } from '@/lib/geo';
import { EmptyState } from '@/components/ShopBits';
import Link from 'next/link';

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false });

const THEMES = [
  { key: 'warm', name: 'Warm Artisanal', desc: 'Terracotta, espresso & cream', swatch: ['#fff8f6', '#3e2723', '#97472e', '#fe997a'] },
  { key: 'espresso', name: 'Dark Espresso Bar', desc: 'Low light, roasted tones', swatch: ['#1b1310', '#5b403c', '#d97736', '#ffdad4'] },
  { key: 'linen', name: 'Linen Minimalist', desc: 'Softer, neutral linen', swatch: ['#faf7f2', '#f4efeb', '#c86d51', '#3e2723'] },
];

const MAP_STYLES = [
  { key: 'warm', name: 'Warm Parchment', icon: 'texture' },
  { key: 'topo', name: 'Vintage Topo', icon: 'landscape' },
  { key: 'mono', name: 'Monochrome', icon: 'contrast' },
];

function fmtUptime(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function SettingsPage() {
  const app = useApp();
  const { authReady, settings, updateSettings, resetSettings, user, favorites, exportFavorites, importFavorites, clearFavorites, confirm, toast, setCenter } = app;
  const isAdmin = user?.role === 'admin';
  const [address, setAddress] = useState(settings.fixedAddress);
  const [geoBusy, setGeoBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [latency, setLatency] = useState([]);
  const [radiusDraft, setRadiusDraft] = useState(settings.radius);
  const fileRef = useRef(null);

  useEffect(() => setAddress(settings.fixedAddress), [settings.fixedAddress]);
  useEffect(() => setRadiusDraft(settings.radius), [settings.radius]);

  const ping = useCallback(async () => {
    const t = performance.now();
    try {
      const h = await api('/api/health');
      const ms = Math.round(performance.now() - t);
      setHealth({ ...h, ms });
      setLatency((l) => [...l.slice(-19), ms]);
    } catch {
      setHealth({ ok: false });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    ping();
    const t = setInterval(ping, 5000);
    return () => clearInterval(t);
  }, [ping, user]);

  const save = (patch, msg = 'Preferences saved') => {
    updateSettings(patch);
    toast(`${msg} to your account`);
  };

  async function geocodeAnchor(e) {
    e?.preventDefault();
    if (!address.trim()) return;
    setGeoBusy(true);
    try {
      const p = await api(`/api/geocode?q=${encodeURIComponent(address)}`);
      await updateSettings({ anchor: 'fixed', fixedAddress: address.trim(), fixedLat: p.lat, fixedLon: p.lon, fixedLabel: p.label });
      setCenter({ lat: p.lat, lon: p.lon, label: p.label, short: address.trim(), source: 'fixed', at: Date.now() });
      toast('Home base set — Explore Map will start here');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGeoBusy(false);
    }
  }

  // Slider works in the user's units; stored in metres.
  const mi = settings.units === 'mi';
  const step = mi ? 0.25 : 0.25;
  const max = mi ? 15 : 25;
  const toUnit = (m) => (mi ? m / METRES_PER_MILE : m / 1000);
  const fromUnit = (v) => Math.round(mi ? v * METRES_PER_MILE : v * 1000);
  const sliderVal = Math.min(max, Math.max(0.25, Math.round(toUnit(radiusDraft) / step) * step));

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importFavorites(Array.isArray(data) ? data : data.favorites);
    } catch {
      toast('That file is not valid JSON.', 'error');
    }
  }

  const sparkMax = Math.max(10, ...latency);
  const spark = latency.map((v, i) => `${(i / Math.max(1, latency.length - 1)) * 200},${40 - (v / sparkMax) * 36}`).join(' ');

  // Settings are part of an account — only logged-in users can see or change them.
  if (!authReady) {
    return (
      <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl space-y-space-lg animate-pulse">
        <div className="h-24 w-2/3 rounded-xl bg-surface-container-high" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-7 h-96 rounded-xl bg-surface-container-lowest" />
          <div className="lg:col-span-5 h-96 rounded-xl bg-surface-container-lowest" />
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl">
        <EmptyState
          icon="lock"
          title="App Settings are for account holders"
          body="Log in to choose your home base, search radius, units, theme and map style. Your preferences are saved to your account on this local server, so they follow you after a restart."
        >
          <div className="flex flex-wrap justify-center gap-space-sm">
            <button onClick={() => app.openAuth('register')} className="px-5 py-2.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md shadow-sm flex items-center gap-1.5">
              <Icon name="person_add" className="text-base" /> Create an account
            </button>
            <button onClick={() => app.openAuth('login')} className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md shadow-sm flex items-center gap-1.5">
              <Icon name="login" className="text-base" /> Log in
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md mb-space-xl">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider">
              {isAdmin ? 'Administrator' : 'Member'} • {user.username}
            </span>
            <span className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <span className={`inline-block w-2 h-2 rounded-full ${health?.ok ? 'bg-tertiary-fixed-dim' : 'bg-error'}`} />
              {health?.ok ? 'Local server online' : 'Checking server…'}
            </span>
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary tracking-tight">
            App Preferences &amp; Local Engine Settings
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
            Choose where discovery starts, how far to look, how things look, and manage the data stored on this machine.
          </p>
        </div>
        <div className="flex items-center gap-space-md bg-surface-container-low p-space-sm rounded-xl shadow-sm self-start lg:self-auto flex-wrap">
          <Chip icon="dns" label="Engine Status" value={health?.ok ? `Healthy (${health.ms}ms)` : '—'} />
          <Chip icon="hard_drive" label="Your Saved Data" value={health ? `${(health.userBytes / 1024).toFixed(1)} KB` : '—'} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* LEFT */}
        <div className="lg:col-span-7 flex flex-col gap-space-lg">
          <Card icon="near_me" title="Location & Discovery Preferences" subtitle="Where Explore Map starts and how results are ordered" tag="Spatial">
            <div className="space-y-space-lg">
              <div>
                <span className="block font-label-md text-label-md text-on-surface mb-2">Default Anchor Location</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mb-3">
                  <AnchorOption
                    active={settings.anchor === 'gps'}
                    icon="my_location"
                    title="Current GPS Location"
                    sub="Browser location each visit"
                    onClick={() => save({ anchor: 'gps' })}
                  />
                  <AnchorOption
                    active={settings.anchor === 'fixed'}
                    icon="home_pin"
                    title="Fixed Home Base"
                    sub={settings.fixedLat != null ? settings.fixedAddress : 'Set an address below'}
                    onClick={() => (settings.fixedLat != null ? save({ anchor: 'fixed' }) : geocodeAnchor())}
                  />
                </div>
                <form onSubmit={geocodeAnchor} className="relative">
                  <Icon name="pin_drop" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-28 py-2.5 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary transition-all"
                    placeholder="e.g. Home: 10 Downing St, London"
                    aria-label="Home base address"
                  />
                  <button
                    type="submit"
                    disabled={geoBusy || !address.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    {geoBusy ? 'Locating…' : 'Geocode'}
                  </button>
                </form>
                {settings.anchor === 'fixed' && settings.fixedLat != null && (
                  <div className="mt-3 relative h-40 rounded-lg overflow-hidden bg-surface-container">
                    <MiniMap lat={settings.fixedLat} lon={settings.fixedLon} zoom={14} mapStyle={settings.mapStyle} interactive={false} label="Home base" />
                  </div>
                )}
              </div>

              <div className="bg-surface-container-low p-space-md rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-label-md text-label-md text-on-surface" htmlFor="radius-slider">Search Radius</label>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-sm text-headline-sm text-secondary font-semibold">{sliderVal.toFixed(2).replace(/\.?0+$/, '')}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{mi ? 'miles' : 'km'}</span>
                  </div>
                </div>
                <input
                  id="radius-slider"
                  type="range"
                  min="0.25"
                  max={max}
                  step={step}
                  value={sliderVal}
                  onChange={(e) => setRadiusDraft(fromUnit(Number(e.target.value)))}
                  onPointerUp={() => radiusDraft !== settings.radius && save({ radius: radiusDraft }, `Radius ${formatDistance(radiusDraft, settings.units)} saved`)}
                  onKeyUp={() => radiusDraft !== settings.radius && save({ radius: radiusDraft }, `Radius ${formatDistance(radiusDraft, settings.units)} saved`)}
                  className="w-full accent-[var(--color-secondary)] cursor-pointer"
                />
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-1.5">
                  <span>{mi ? '¼ mi (Walking)' : '250 m (Walking)'}</span>
                  <span>{mi ? '5 mi (Biking)' : '8 km (Biking)'}</span>
                  <span>{mi ? '15 mi (Drive)' : '25 km (Drive)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-2">
                <div>
                  <span className="block font-label-md text-label-md text-on-surface mb-2">Distance Units</span>
                  <div className="flex rounded-lg bg-surface-container-low p-1">
                    {[
                      ['mi', 'Miles (Imperial)'],
                      ['km', 'Kilometers (Metric)'],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => save({ units: k })}
                        aria-pressed={settings.units === k}
                        className={`flex-1 py-1.5 text-center font-label-md text-label-md rounded transition-all ${
                          settings.units === k ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="sort">Default Sort Order</label>
                  <div className="relative">
                    <select
                      id="sort"
                      value={settings.sort}
                      onChange={(e) => save({ sort: e.target.value })}
                      className="w-full py-2 px-3 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                    >
                      <option value="distance">Distance (Proximity First)</option>
                      <option value="open">Open Now First</option>
                      <option value="name">Name (A – Z)</option>
                    </select>
                    <Icon name="expand_more" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card
            icon="database"
            title="Local Persistence & Data Management"
            subtitle="Your account data lives in a JSON file on this machine"
            tag={
              <span className="flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                <Icon name="save" className="text-sm" /> Persistent
              </span>
            }
          >
            <div className="p-3.5 rounded-lg bg-surface-container-low flex items-start gap-3 mb-space-lg">
              <Icon name="verified_user" className="text-secondary text-xl shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-title-sm text-title-sm text-on-surface">JSON File Storage Engine</span>
                  <span className="font-label-sm text-label-sm px-2 rounded-full bg-secondary-container text-on-secondary-container font-mono">data/db.json</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Favourites, notes and preferences are written atomically to disk, so they survive server restarts, browser restarts and reboots. Passwords are stored as salted scrypt hashes.
                </p>
              </div>
            </div>

            {user ? (
              <>
                <div className="space-y-1.5 mb-space-lg">
                  <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>{favorites.length} saved spots • {favorites.reduce((n, f) => n + (f.cupping?.length || 0), 0)} cupping logs</span>
                    <span className="font-mono">{health ? `${(health.userBytes / 1024).toFixed(1)} KB used` : '…'}</span>
                  </div>
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden flex">
                    <div
                      className="bg-secondary h-full rounded-full transition-all"
                      style={{ width: health ? `${Math.min(100, Math.max(2, (health.userBytes / (512 * 1024)) * 100))}%` : '0%' }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-space-sm">
                  <button onClick={() => exportFavorites()} disabled={!favorites.length} className="px-3.5 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                    <Icon name="download" className="text-base" /> Export Favorites (JSON)
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="px-3.5 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5">
                    <Icon name="file_upload" className="text-base text-secondary" /> Import Backup
                  </button>
                  <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Clear all saved favourites?',
                        body: 'This permanently deletes every saved spot, note and cupping log from your account. Export a backup first if you might want them back.',
                        confirmLabel: 'Delete everything',
                        danger: true,
                      });
                      if (ok) clearFavorites();
                    }}
                    disabled={!favorites.length}
                    className="px-3.5 py-2 rounded-full bg-error-container text-on-error-container font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Icon name="delete_sweep" className="text-base" /> Clear Saved Data
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-dashed border-outline-variant">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Log in to back up, import or clear your saved favourites. Preferences on this page are kept in this browser until you do.</p>
                <button onClick={app.openAuth} className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
                  Log in
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 flex flex-col gap-space-lg">
          <Card icon="palette" title="Aesthetic & Atmosphere" subtitle="Applies instantly across the app">
            <span className="block font-label-md text-label-md text-on-surface mb-2">App Theme Atmosphere</span>
            <div className="space-y-2 mb-space-lg">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => save({ theme: t.key }, `${t.name} theme saved`)}
                  aria-pressed={settings.theme === t.key}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg text-left transition-all ${
                    settings.theme === t.key ? 'bg-surface-container ring-2 ring-secondary' : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {t.swatch.map((c) => (
                        <span key={c} className="w-6 h-6 rounded-full ring-2 ring-surface-container-lowest" style={{ background: c }} />
                      ))}
                    </div>
                    <div>
                      <div className="font-label-md text-label-md text-on-surface">{t.name}</div>
                      <div className="font-label-sm text-label-sm text-on-surface-variant">{t.desc}</div>
                    </div>
                  </div>
                  <Icon name={settings.theme === t.key ? 'check_circle' : 'radio_button_unchecked'} fill={settings.theme === t.key} className={settings.theme === t.key ? 'text-secondary' : 'text-outline'} />
                </button>
              ))}
            </div>

            <span className="block font-label-md text-label-md text-on-surface mb-2">Map Cartography Visuals</span>
            <div className="grid grid-cols-3 gap-2">
              {MAP_STYLES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => save({ mapStyle: m.key }, `${m.name} map saved`)}
                  aria-pressed={settings.mapStyle === m.key}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all ${
                    settings.mapStyle === m.key ? 'bg-primary-container text-on-primary-container shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <Icon name={m.icon} className={settings.mapStyle === m.key ? 'text-secondary-container' : 'text-secondary'} />
                  <span className="font-label-sm text-label-sm text-center">{m.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {isAdmin && (
          <Card
            icon="monitor_heart"
            title="Local Server Diagnostics"
            subtitle="Admin only • live from this machine, refreshed every 5 seconds"
            tag={
              <Link href="/admin" className="flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-primary-container text-on-primary shrink-0">
                <Icon name="admin_panel_settings" className="text-sm" /> Admin Console
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-space-sm mb-space-md">
              <Stat label="Hosted Web Engine" value={health ? `Next.js • ${health.mode}` : '—'} />
              <Stat label="Engine Health" value={health?.ok ? 'Healthy' : '—'} accent />
              <Stat label="Uptime" value={health ? fmtUptime(health.uptimeSec) : '—'} />
              <Stat label="Memory" value={health ? `${health.memoryMb} MB` : '—'} />
              <Stat label="DB Read" value={health ? `${health.dbReadMs} ms` : '—'} />
              <Stat label="Cached Searches" value={health ? String(health.cachedSearches) : '—'} />
            </div>
            <div className="bg-surface-container-low rounded-lg p-3">
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mb-1">
                <span>Response latency</span>
                <span className="font-mono">{latency.length ? `${latency[latency.length - 1]} ms` : '…'}</span>
              </div>
              <svg viewBox="0 0 200 40" className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
                {latency.length > 1 && <polyline points={spark} fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              </svg>
            </div>
            <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
              {health ? `${health.platform} • ${health.users} account${health.users === 1 ? '' : 's'} on this server` : ''}
            </p>
          </Card>
          )}

          <div className="flex flex-wrap gap-space-sm justify-end">
            <button
              onClick={async () => {
                if (await confirm({ title: 'Reset preferences?', body: 'Radius, units, sort order, theme and map style go back to their defaults. Your favourites are not affected.', confirmLabel: 'Reset' })) {
                  resetSettings();
                  toast('Preferences reset to defaults');
                }
              }}
              className="px-4 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5"
            >
              <Icon name="restart_alt" className="text-base" /> Reset Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, title, subtitle, tag, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex items-start justify-between gap-space-sm mb-space-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary shrink-0">
            <Icon name={icon} className="text-xl" />
          </div>
          <div>
            <h2 className="font-title-md text-title-md text-primary">{title}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        {typeof tag === 'string' ? (
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant shrink-0">{tag}</span>
        ) : (
          tag
        )}
      </div>
      {children}
    </section>
  );
}

function AnchorOption({ active, icon, title, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between p-3 rounded-lg text-left transition-all ${
        active ? 'bg-primary-container text-on-primary-container shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} fill={active} className={`text-lg ${active ? 'text-secondary-container' : 'text-outline'}`} />
        <div className="min-w-0">
          <div className={`font-label-md text-label-md ${active ? 'text-white' : ''}`}>{title}</div>
          <div className={`font-label-sm text-label-sm truncate ${active ? 'opacity-80' : 'text-on-surface-variant'}`}>{sub}</div>
        </div>
      </div>
      <Icon name={active ? 'check_circle' : 'radio_button_unchecked'} className={`text-lg ${active ? '' : 'text-outline'}`} />
    </button>
  );
}

function Chip({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest rounded-lg shadow-sm">
      <Icon name={icon} fill className="text-secondary text-lg" />
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">{label}</span>
        <span className="font-title-sm text-title-sm text-on-surface leading-none mt-1">{value}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-3">
      <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      <p className={`font-title-sm text-title-sm ${accent ? 'text-on-tertiary-container' : 'text-primary'}`}>{value}</p>
    </div>
  );
}
