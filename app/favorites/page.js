'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/Providers';
import Icon from '@/components/Icon';
import CafeArt from '@/components/CafeArt';
import { EmptyState, StatusBadge, amenityList } from '@/components/ShopBits';
import { AddSpotDrawer, CuppingModal, MapModal, NoteModal } from '@/components/FavoriteModals';
import { formatDistance, haversine } from '@/lib/geo';
import { openStatus, statusLabel } from '@/lib/hours';

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  const units = [
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let v = s / 60;
  for (const [step, name] of units) {
    if (v < step) {
      const n = Math.floor(v);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
    v /= step;
  }
  return '';
}

export default function FavoritesPage() {
  const app = useApp();
  const { user, authReady, favorites, center, settings, removeFavorite, exportFavorites, importFavorites, clearFavorites, confirm, toast } = app;
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [noteFor, setNoteFor] = useState(null);
  const [mapFor, setMapFor] = useState(null);
  const [cupFor, setCupFor] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const fileRef = useRef(null);

  const enriched = useMemo(
    () =>
      favorites.map((f) => ({
        ...f,
        distance: center ? haversine(center.lat, center.lon, f.lat, f.lon) : null,
        status: openStatus(f.openingHours),
      })),
    [favorites, center],
  );

  const topTags = useMemo(() => {
    const counts = new Map();
    favorites.forEach((f) => (f.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  }, [favorites]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched
      .filter((f) => {
        if (tag === 'open' && !f.status?.open) return false;
        if (tag === 'notes' && !(f.note || f.cupping?.length)) return false;
        if (tag === 'custom' && !f.custom) return false;
        if (!['all', 'open', 'notes', 'custom'].includes(tag) && !(f.tags || []).includes(tag)) return false;
        if (!needle) return true;
        const hay = [f.name, f.address, f.neighborhood, f.note, f.cuisine, ...(f.tags || []), ...(f.cupping || []).flatMap((c) => [c.bean, c.journal, ...(c.descriptors || [])])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => (settings.sort === 'name' ? a.name.localeCompare(b.name) : 0));
  }, [enriched, q, tag, settings.sort]);

  const notesCount = favorites.reduce((n, f) => n + (f.note ? 1 : 0) + (f.cupping?.length || 0), 0);
  const footprintKb = (new Blob([JSON.stringify(favorites)]).size / 1024).toFixed(1);
  const openCount = enriched.filter((f) => f.status?.open).length;
  const lastSaved = favorites.reduce((m, f) => (f.updatedAt > m ? f.updatedAt : f.savedAt > m ? f.savedAt : m), '');
  const withNotesPct = favorites.length ? Math.round((favorites.filter((f) => f.note || f.cupping?.length).length / favorites.length) * 100) : 0;

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

  async function onClear() {
    const ok = await confirm({
      title: 'Clear all saved favourites?',
      body: `This permanently deletes ${favorites.length} saved spot${favorites.length === 1 ? '' : 's'}, including personal notes and cupping logs, from your account. Export a backup first if you might want them back.`,
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (ok) clearFavorites();
  }

  async function onRemove(f) {
    const hasNotes = f.note || f.cupping?.length;
    if (hasNotes) {
      const ok = await confirm({
        title: `Remove ${f.name}?`,
        body: 'Your personal note and cupping logs for this spot will be deleted too.',
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
    }
    removeFavorite(f.id);
  }

  if (authReady && !user) {
    return (
      <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl">
        <EmptyState
          icon="bookmark"
          title="Log in to see your saved coffee sanctuaries"
          body="Favourites, personal notes and cupping logs are saved to your account on this local server, so they're still here after a restart."
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
    <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl space-y-space-xl">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-xs max-w-2xl">
          <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
            <Icon name="dns" className="text-sm text-secondary" />
            <span>Self-Hosted Storage</span>
          </div>
          <h1 className="font-headline-display-mobile text-headline-display-mobile md:font-headline-display md:text-headline-display text-primary tracking-tight">
            My Saved Coffee Sanctuaries
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {favorites.length} coffee spot{favorites.length === 1 ? '' : 's'} saved to your account on this local server. They survive server restarts, browser restarts and reboots.
          </p>
        </div>
        <div className="flex items-center gap-space-md shrink-0 bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
          <div className="text-right">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Sync State</p>
            <p className="font-headline-sm text-headline-sm text-secondary">Saved on Disk</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
            <Icon name="save" />
          </div>
        </div>
      </div>

      {/* Storage panel */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
        <div className="p-space-lg md:p-space-xl space-y-space-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-low/60 p-space-md rounded-lg">
            <div className="flex items-center gap-space-md">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed-dim opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary-container" />
              </span>
              <div>
                <p className="font-title-sm text-title-sm text-primary flex flex-wrap items-center gap-2">
                  Storage Status: Saved &amp; Persistent
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-mono">data/db.json</span>
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Survives restarts &amp; reloads.{lastSaved ? ` Last change saved ${timeAgo(lastSaved)}.` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-xs">
              <button
                onClick={() => exportFavorites()}
                disabled={!favorites.length}
                className="px-3.5 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all disabled:opacity-50"
              >
                <Icon name="download" className="text-base" />
                <span>Export Favorites (JSON)</span>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3.5 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors"
              >
                <Icon name="file_upload" className="text-base text-secondary" />
                <span>Import Backup</span>
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
              <button
                onClick={onClear}
                disabled={!favorites.length}
                className="px-3.5 py-2 rounded-full bg-error-container text-on-error-container font-label-md text-label-md flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Icon name="delete_sweep" className="text-base" />
                <span>Clear Saved Data</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
            <Metric label="Saved Locations" value={String(favorites.length).padStart(2, '0')} unit="coffee spots" />
            <Metric label="Personal Notes" value={String(notesCount).padStart(2, '0')} unit="notes & cupping logs" />
            <Metric label="Account Footprint" value={footprintKb} unit="KB on local disk" accent="text-secondary" />
            <Metric label="Open Right Now" value={String(openCount).padStart(2, '0')} unit={`of ${favorites.length} favourites`} accent="text-on-tertiary-container" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Favourites with personal notes or cupping logs</span>
              <span className="font-mono">{withNotesPct}%</span>
            </div>
            <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden flex">
              <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${withNotesPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md">
        <div className="relative flex-1 max-w-md">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-surface-container-lowest rounded-full font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary shadow-sm"
            placeholder="Filter by name, bean origin, or personal note..."
            aria-label="Filter favourites"
          />
        </div>
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {[
            ['all', `All Spots (${favorites.length})`],
            ['open', 'Open Now'],
            ['notes', 'With Notes'],
            ['custom', 'Secret Spots'],
            ...topTags.map((t) => [t, `#${t}`]),
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTag(key)}
              aria-pressed={tag === key}
              className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors shrink-0 ${
                tag === key ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!authReady ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          {[0, 1].map((i) => (
            <div key={i} className="h-96 rounded-xl bg-surface-container-lowest animate-pulse" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          {visible.map((f) => (
            <FavoriteCard
              key={f.id}
              fav={f}
              units={settings.units}
              onRemove={() => onRemove(f)}
              onNote={() => setNoteFor(f)}
              onMap={() => setMapFor(f)}
              onCupping={() => setCupFor(f)}
            />
          ))}
        </div>
      ) : favorites.length ? (
        <EmptyState icon="local_cafe" title="No Matching Sanctuaries" body="Try tweaking your search term or filter tags. Your saved spots are untouched.">
          <button onClick={() => { setQ(''); setTag('all'); }} className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
            Reset All Filters
          </button>
        </EmptyState>
      ) : (
        <EmptyState icon="favorite" title="No favourites yet" body="Tap the heart on any coffee shop in Explore Map, or add a secret spot that isn't on the map.">
          <Link href="/" className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
            Explore the map
          </Link>
        </EmptyState>
      )}

      {/* Floating add button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-12 z-40">
        <button
          onClick={() => setDrawer(true)}
          className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-secondary text-on-secondary shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Icon name="add_location_alt" className="text-xl" />
          <span className="font-label-lg text-label-lg tracking-wide hidden sm:inline">Add Custom Local Spot or Secret Gem</span>
          <span className="font-label-lg text-label-lg sm:hidden">Add Spot</span>
        </button>
      </div>

      <AddSpotDrawer open={drawer} onClose={() => setDrawer(false)} />
      {noteFor && <NoteModal fav={noteFor} onClose={() => setNoteFor(null)} />}
      {mapFor && <MapModal fav={mapFor} onClose={() => setMapFor(null)} />}
      {cupFor && <CuppingModal fav={cupFor} onClose={() => setCupFor(null)} />}
    </div>
  );
}

function Metric({ label, value, unit, accent = 'text-primary' }) {
  return (
    <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <div className="mt-space-xs flex items-baseline gap-2 flex-wrap">
        <span className={`font-headline-md text-headline-md md:font-headline-lg md:text-headline-lg ${accent}`}>{value}</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">{unit}</span>
      </div>
    </div>
  );
}

function FavoriteCard({ fav, units, onRemove, onNote, onMap, onCupping }) {
  const meta = [fav.neighborhood, fav.distance != null ? `${formatDistance(fav.distance, units)} away` : null, statusLabel(fav.status)]
    .filter(Boolean)
    .join(' • ');
  const amen = amenityList(fav.amenities);
  const latest = fav.cupping?.[0];
  const detailHref = fav.custom ? null : `/shop/${fav.id}`;

  return (
    <article className="flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300">
      <div className="space-y-space-md">
        <CafeArt id={fav.id} name={fav.name} kind={fav.kind} className="h-48 w-full rounded-lg">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
            <Icon name="star" fill className="text-xs text-secondary-container" />
            <span className="font-label-sm text-label-sm text-primary font-semibold">{fav.custom ? 'Secret Spot' : `Starred ${fav.kind || 'Café'}`}</span>
          </div>
          <div className="absolute top-3 right-3 bg-primary-container text-on-primary px-2.5 py-1 rounded-full font-label-sm text-label-sm shadow-sm">
            Saved {timeAgo(fav.savedAt)}
          </div>
          <div className="absolute bottom-3 left-3">
            <StatusBadge hours={fav.openingHours} long />
          </div>
        </CafeArt>

        <div className="flex items-start justify-between gap-space-sm">
          <div className="min-w-0">
            {detailHref ? (
              <Link href={detailHref} className="font-headline-md text-headline-md text-primary leading-tight hover:underline decoration-secondary/50">
                {fav.name}
              </Link>
            ) : (
              <h2 className="font-headline-md text-headline-md text-primary leading-tight">{fav.name}</h2>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1 mt-0.5">
              <Icon name="pin_drop" className="text-sm text-secondary mt-0.5" />
              <span>{meta || fav.address || 'Saved location'}</span>
            </p>
          </div>
          <button
            onClick={onRemove}
            className="w-9 h-9 shrink-0 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-secondary transition-colors"
            title="Remove from favourites"
            aria-label={`Remove ${fav.name} from favourites`}
          >
            <Icon name="bookmark" fill />
          </button>
        </div>

        <button onClick={onNote} className="w-full text-left bg-surface-container-low rounded-lg p-space-md flex gap-space-sm items-start hover:bg-surface-container transition-colors">
          <Icon name="edit_note" className="text-secondary shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Personal Note</p>
            {fav.note ? (
              <p className="font-serif text-body-md text-primary italic leading-snug">“{fav.note}”</p>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Add a note — what to order, where to sit, when it&apos;s quiet…</p>
            )}
          </div>
        </button>

        {latest && (
          <div className="rounded-lg border border-surface-container-high p-space-md space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1">
                <Icon name="coffee" className="text-sm text-secondary" /> Cupping Log ({fav.cupping.length})
              </p>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{latest.method}</span>
            </div>
            <p className="font-title-sm text-title-sm text-primary truncate">{latest.bean || 'Untitled cup'}</p>
            {latest.descriptors?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {latest.descriptors.slice(0, 4).map((d) => (
                  <span key={d} className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {(fav.tags?.length > 0 || amen.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {(fav.tags || []).map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-medium">
                #{t}
              </span>
            ))}
            {amen.slice(0, 3).map((a) => (
              <span key={a.key} className="px-2.5 py-1 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-secondary font-medium">
                {a.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-space-lg bg-surface-container-low/40 -mx-space-lg -mb-space-lg p-space-md rounded-b-xl">
        <div className="flex items-center gap-space-xs flex-wrap">
          <button onClick={onMap} className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors">
            <Icon name="map" className="text-sm text-secondary" /> View Map
          </button>
          <button onClick={onNote} className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors">
            <Icon name="edit" className="text-sm" /> Edit Note
          </button>
          <button onClick={onCupping} className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors">
            <Icon name="coffee" className="text-sm text-secondary" /> Cupping Note
          </button>
        </div>
        <button
          onClick={onRemove}
          className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors"
          title="Remove from favourites"
          aria-label={`Delete ${fav.name}`}
        >
          <Icon name="delete" className="text-lg" />
        </button>
      </div>
    </article>
  );
}
