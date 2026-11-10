'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useApp } from '@/components/Providers';
import Icon from '@/components/Icon';
import CafeArt from '@/components/CafeArt';
import { StatusBadge, amenityList } from '@/components/ShopBits';
import { formatDistance, haversine, METRES_PER_MILE, walkMinutes } from '@/lib/geo';
import { openStatus, statusLabel } from '@/lib/hours';

const ShopMap = dynamic(() => import('@/components/ShopMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-container text-on-surface-variant font-label-md text-label-md">
      Loading map…
    </div>
  ),
});

const MAP_STYLES = [
  { key: 'warm', label: 'Warm Atlas' },
  { key: 'topo', label: 'Topo' },
  { key: 'mono', label: 'Mono' },
];

export default function ExplorePage() {
  const router = useRouter();
  const app = useApp();
  const { settings, center, setCenter, authReady, favorites, isFavorite, toggleFavorite, user, openDirections } = app;
  const units = settings.units;

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState('');
  const [pill, setPill] = useState('all');
  const [sort, setSort] = useState(settings.sort);
  const [mapCenter, setMapCenter] = useState(null);
  const mapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => setSort(settings.sort), [settings.sort]);

  // ── Locate via the browser ──
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location. Search for a place in the header instead.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCenter({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'Your current location',
          short: 'Your Location',
          source: 'gps',
          at: Date.now(),
        }),
      () => {
        setLoading(false);
        setError('Location access was blocked. Allow it in your browser or search a place above.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [setCenter]);

  // ── Decide where to start once the session + preferences have loaded ──
  const booted = useRef(false);
  useEffect(() => {
    if (!authReady || booted.current) return;
    booted.current = true;
    if (center) return; // already have one (session restore or header search)
    if (settings.anchor === 'fixed' && settings.fixedLat != null) {
      setCenter({
        lat: settings.fixedLat,
        lon: settings.fixedLon,
        label: settings.fixedLabel || settings.fixedAddress,
        short: settings.fixedAddress || 'Home Base',
        source: 'fixed',
        at: Date.now(),
      });
    } else {
      locate();
    }
  }, [authReady, center, settings, setCenter, locate]);

  // ── Fetch cafés whenever the centre or radius changes ──
  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedId(null);
    api(`/api/shops?lat=${center.lat}&lon=${center.lon}&radius=${settings.radius}`)
      .then((d) => {
        if (cancelled) return;
        setShops(d.shops);
        if (!d.shops.length) setError(`No coffee shops found within ${formatDistance(settings.radius, units)}. Try a wider search radius in App Settings, or zoom out and use "Search this area".`);
      })
      .catch((e) => !cancelled && (setShops([]), setError(e.message)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lon, center?.at, settings.radius]);

  // ── Filtering & sorting ──
  const nearLimit = units === 'mi' ? METRES_PER_MILE : 1000;
  const enriched = useMemo(
    () => shops.map((s) => ({ ...s, status: openStatus(s.openingHours), saved: isFavorite(s.id) })),
    [shops, isFavorite],
  );
  const counts = useMemo(
    () => ({
      all: enriched.length,
      open: enriched.filter((s) => s.status?.open).length,
      saved: enriched.filter((s) => s.saved).length,
      wifi: enriched.filter((s) => s.amenities?.wifi).length,
      outdoor: enriched.filter((s) => s.amenities?.outdoor).length,
      near: enriched.filter((s) => s.distance < nearLimit).length,
    }),
    [enriched, nearLimit],
  );
  const PILLS = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'open', label: `Open Now (${counts.open})` },
    { key: 'saved', label: `Saved (${counts.saved})` },
    { key: 'wifi', label: 'Wi-Fi & Work' },
    { key: 'outdoor', label: 'Outdoor Seating' },
    { key: 'near', label: `< 1.0 ${units === 'mi' ? 'mi' : 'km'}` },
  ];

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    let out = enriched.filter((s) => {
      if (pill === 'open' && !s.status?.open) return false;
      if (pill === 'saved' && !s.saved) return false;
      if (pill === 'wifi' && !s.amenities?.wifi) return false;
      if (pill === 'outdoor' && !s.amenities?.outdoor) return false;
      if (pill === 'near' && !(s.distance < nearLimit)) return false;
      if (!q) return true;
      return [s.name, s.address, s.neighborhood, s.cuisine, s.kind, s.brand].some((v) => v?.toLowerCase().includes(q));
    });
    if (sort === 'name') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'open') out = [...out].sort((a, b) => (b.status?.open ? 1 : 0) - (a.status?.open ? 1 : 0) || a.distance - b.distance);
    return out;
  }, [enriched, text, pill, sort, nearLimit]);

  // "Search this area" appears when the map has moved away from the search centre.
  const movedAway =
    mapCenter && center && haversine(mapCenter.lat, mapCenter.lng, center.lat, center.lon) > Math.max(400, settings.radius * 0.4);

  const select = (id) => {
    setSelectedId(id);
    document.getElementById(`shop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const openDetails = (id) => router.push(`/shop/${id}`);

  return (
    <div className="max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-md">
      {/* Top context strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="explore" className="text-sm" />
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider truncate max-w-[50vw]" title={center?.label}>
            {center?.short || 'Finding your location…'}
          </span>
          {center && (
            <>
              <span className="text-outline-variant font-label-md">•</span>
              <span className="font-body-sm text-body-sm text-on-surface font-medium">
                {loading ? 'Brewing results…' : `${shops.length} coffee spots within ${formatDistance(settings.radius, units)}`}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant shadow-sm">
            <span className={`w-2 h-2 rounded-full ${user ? 'bg-tertiary-fixed-dim animate-pulse' : 'bg-outline'}`} />
            <span className="font-label-sm text-label-sm">
              {user ? `${favorites.length} favourites saved to your account` : 'Log in to save favourites'}
            </span>
          </div>
          {user ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface-variant font-label-sm text-label-sm transition-colors shadow-sm"
            >
              <Icon name="tune" className="text-xs" /> Preferences
            </Link>
          ) : (
            <button
              onClick={() => app.openAuth('register')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm shadow-sm"
            >
              <Icon name="person_add" className="text-xs" /> Create free account
            </button>
          )}
        </div>
      </div>

      {/* Split-screen canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-170px)] lg:min-h-[620px]">
        {/* LEFT: directory */}
        <aside className="order-2 lg:order-1 lg:col-span-5 flex flex-col lg:h-full bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 md:p-5 bg-surface-container-low flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-lg" />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-surface-bright pl-10 pr-9 py-2 rounded-full font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 shadow-sm placeholder:text-on-surface-variant"
                  placeholder="Filter by name, street, or style..."
                  aria-label="Filter coffee shops"
                />
                {text && (
                  <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface" aria-label="Clear filter">
                    <Icon name="close" className="text-sm" />
                  </button>
                )}
              </div>
              <div className="relative shrink-0">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="appearance-none bg-surface-bright pl-3 pr-7 py-2 rounded-full font-label-sm text-label-sm text-on-surface font-semibold focus:outline-none shadow-sm cursor-pointer"
                  aria-label="Sort order"
                >
                  <option value="distance">Closest First</option>
                  <option value="open">Open First</option>
                  <option value="name">A – Z</option>
                </select>
                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {PILLS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPill(p.key)}
                  aria-pressed={pill === p.key}
                  className={`shrink-0 px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors shadow-sm active:scale-95 ${
                    pill === p.key
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'bg-surface-container-high hover:bg-surface-variant text-on-surface font-medium'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={listRef} className="flex-1 lg:overflow-y-auto p-4 space-y-3.5 bg-surface-container-lowest">
            {error && (
              <div className="p-3.5 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex gap-2">
                <Icon name="error" className="text-base mt-0.5" />
                <div className="flex-1">
                  {error}
                  <button onClick={locate} className="block mt-1 font-semibold underline">Try my location again</button>
                </div>
              </div>
            )}
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-surface-container-low animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded-full bg-surface-container-high" />
                  <div className="h-5 w-2/3 rounded-full bg-surface-container-high" />
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-surface-container-high" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-full rounded-full bg-surface-container-high" />
                      <div className="h-3 w-1/2 rounded-full bg-surface-container-high" />
                    </div>
                  </div>
                </div>
              ))}
            {!loading && !error && center && list.length === 0 && shops.length > 0 && (
              <div className="text-center py-space-xl text-on-surface-variant font-body-sm text-body-sm">
                No spots match this filter.{' '}
                <button className="text-secondary font-semibold underline" onClick={() => { setPill('all'); setText(''); }}>
                  Reset filters
                </button>
              </div>
            )}
            {!loading && !center && !error && (
              <div className="text-center py-space-xl text-on-surface-variant font-body-sm text-body-sm">
                Allow location access, or search a neighbourhood in the header to find coffee near it.
              </div>
            )}
            {!loading &&
              list.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  units={units}
                  selected={shop.id === selectedId}
                  saved={shop.saved}
                  onSelect={() => setSelectedId(shop.id)}
                  onToggleFav={() => toggleFavorite(shop)}
                  onDetails={() => openDetails(shop.id)}
                  onDirections={() => openDirections(shop)}
                />
              ))}
          </div>

          <div className="shrink-0 px-4 py-3 bg-surface-container-low flex items-center justify-between gap-2 font-label-sm text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Icon name="database" className="text-sm text-secondary" />
              Café data from OpenStreetMap
            </span>
            <Link href="/favorites" className="inline-flex items-center gap-1 text-secondary font-bold hover:underline">
              Saved Favorites <Icon name="arrow_forward" className="text-xs" />
            </Link>
          </div>
        </aside>

        {/* RIGHT: map canvas */}
        <section className="order-1 lg:order-2 lg:col-span-7 relative h-[52vh] lg:h-full rounded-2xl overflow-hidden shadow-xl bg-surface-container">
          <ShopMap
            center={center}
            shops={shops}
            favorites={favorites}
            selectedId={selectedId}
            onSelect={select}
            onDetails={openDetails}
            onDirections={(id) => {
              const s = shops.find((x) => x.id === id) || favorites.find((x) => x.id === id);
              if (s) openDirections(s);
            }}
            onReady={(m) => (mapRef.current = m)}
            onMoveEnd={setMapCenter}
            mapStyle={settings.mapStyle}
            units={units}
          />

          {/* Floating top bar */}
          <div className="absolute top-0 inset-x-0 z-[500] p-3 md:p-4 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto">
              {movedAway && !loading && (
                <button
                  onClick={() =>
                    setCenter({ lat: mapCenter.lat, lon: mapCenter.lng, label: 'Map area', short: 'This Map Area', source: 'map', at: Date.now() })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-primary font-label-md text-label-md font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <Icon name="refresh" className="text-secondary text-base" /> Search this area
                </button>
              )}
            </div>
            <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-lg">
              {MAP_STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => app.updateSettings({ mapStyle: s.key })}
                  className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-colors ${
                    settings.mapStyle === s.key
                      ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                      : 'hover:bg-surface-container text-on-surface-variant font-medium'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom & recenter */}
          <div className="absolute right-4 bottom-20 z-[500] flex flex-col gap-2 select-none">
            <div className="flex flex-col bg-surface-container-lowest/95 backdrop-blur-md rounded-full shadow-lg overflow-hidden">
              <button onClick={() => mapRef.current?.zoomIn()} className="w-10 h-10 flex items-center justify-center text-on-surface hover:bg-surface-container" title="Zoom in" aria-label="Zoom in">
                <Icon name="add" className="text-lg" />
              </button>
              <div className="h-px w-6 mx-auto bg-surface-container-high" />
              <button onClick={() => mapRef.current?.zoomOut()} className="w-10 h-10 flex items-center justify-center text-on-surface hover:bg-surface-container" title="Zoom out" aria-label="Zoom out">
                <Icon name="remove" className="text-lg" />
              </button>
            </div>
            <button
              onClick={locate}
              className="w-10 h-10 rounded-full bg-surface-container-lowest/95 backdrop-blur-md text-secondary shadow-lg hover:bg-secondary hover:text-on-secondary transition-all flex items-center justify-center"
              title="Recenter to my current location"
              aria-label="Recenter to my current location"
            >
              <Icon name="my_location" className="text-lg" />
            </button>
          </div>

          {/* Bottom status */}
          <div className="absolute bottom-0 inset-x-0 z-[500] p-3 md:p-4 pointer-events-none flex justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface-container-lowest/95 backdrop-blur-md shadow-xl text-on-surface font-body-sm text-body-sm">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tertiary-container text-tertiary-fixed-dim">
                <Icon name="offline_pin" className="text-xs" />
              </span>
              <span className="hidden sm:inline">Favourites are saved on this local server • Persist across restarts</span>
              <span className="sm:hidden">Saved on your local server</span>
              {user ? (
                <Link href="/settings" className="font-label-sm text-label-sm text-secondary font-bold hover:underline ml-1">
                  Settings
                </Link>
              ) : (
                <button onClick={() => app.openAuth('register')} className="font-label-sm text-label-sm text-secondary font-bold hover:underline ml-1">
                  Sign up
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ShopCard({ shop, units, selected, saved, onSelect, onToggleFav, onDetails, onDirections }) {
  const amen = amenityList(shop.amenities);
  const subtitle = statusLabel(shop.status) || shop.address || shop.kind;
  return (
    <article
      id={`shop-${shop.id}`}
      onClick={onSelect}
      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
        selected ? 'bg-surface-container-low shadow-md' : 'bg-surface-bright shadow-sm hover:shadow-md'
      }`}
    >
      {selected && <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-secondary rounded-r-full" />}
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {selected && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-bold">Active Pin</span>
            )}
            <StatusBadge hours={shop.openingHours} />
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">{formatDistance(shop.distance, units)}</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-primary truncate">{shop.name}</h2>
          <div className="flex items-center gap-1.5 mt-0.5 text-on-surface-variant min-w-0">
            <span className="font-body-sm text-body-sm text-secondary font-medium truncate">{subtitle}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className={`shrink-0 p-2 rounded-full hover:scale-105 transition-transform ${
            saved ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'
          }`}
          title={saved ? 'Remove from favourites' : 'Save to favourites'}
          aria-label={saved ? `Remove ${shop.name} from favourites` : `Save ${shop.name} to favourites`}
          aria-pressed={saved}
        >
          <Icon name="favorite" fill={saved} className="text-lg" />
        </button>
      </div>

      <div className="mt-3 pl-2 flex gap-3">
        <CafeArt id={shop.id} name={shop.name} kind={shop.kind} compact className="w-20 h-20 rounded-lg shrink-0 shadow-inner" />
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">{shop.kind}</span>
            {amen.slice(0, 2).map((a) => (
              <span key={a.key} className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                {a.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant pt-1 min-w-0">
            <Icon name={shop.cuisine ? 'local_cafe' : 'pin_drop'} className="text-secondary text-sm" />
            <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
              {shop.cuisine ? `Serves: ${shop.cuisine}` : shop.address || shop.neighborhood || 'Address not listed'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between bg-surface-container-lowest/60 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl gap-2">
        <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm min-w-0">
          <Icon name="directions_walk" className="text-sm text-secondary" />
          <span>{walkMinutes(shop.distance)} min walk</span>
          {shop.amenities?.wifi && (
            <>
              <span className="text-outline-variant">•</span>
              <Icon name="wifi" className="text-sm text-secondary" />
            </>
          )}
          {shop.amenities?.outdoor && <Icon name="deck" className="text-sm text-secondary" />}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
            className="font-label-sm text-label-sm text-primary font-bold hover:underline"
          >
            Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDirections();
            }}
            className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary font-bold hover:underline"
          >
            Directions ({walkMinutes(shop.distance)} min) <Icon name="arrow_forward" className="text-xs" />
          </button>
        </div>
      </div>
    </article>
  );
}
