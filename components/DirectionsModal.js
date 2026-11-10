'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from './Icon';
import { api, useApp } from './Providers';
import { formatDistance, haversine } from '@/lib/geo';

const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-surface-container animate-pulse" />,
});

const MODES = [
  { key: 'foot', label: 'Walk', icon: 'directions_walk' },
  { key: 'bike', label: 'Cycle', icon: 'directions_bike' },
  { key: 'car', label: 'Drive', icon: 'directions_car' },
];

function fmtDuration(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const fmtClock = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Smallest distance (m) from a point to the route's vertices — good enough to detect leaving the route. */
function distanceToRoute(p, coords) {
  let best = Infinity;
  for (let i = 0; i < coords.length; i += 1) {
    const d = haversine(p.lat, p.lon, coords[i][0], coords[i][1]);
    if (d < best) best = d;
  }
  return best;
}

export default function DirectionsModal({ dest, onClose }) {
  const { center, settings, toast } = useApp();
  const units = settings.units;
  const [mode, setMode] = useState('foot');
  const [origin, setOrigin] = useState(() =>
    center ? { lat: center.lat, lon: center.lon, label: center.source === 'gps' ? 'Your location' : center.short || 'Search centre', gps: center.source === 'gps' } : null,
  );
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [me, setMe] = useState(null);
  const [active, setActive] = useState(0);
  const [arrived, setArrived] = useState(false);
  const watchRef = useRef(null);
  const lastReroute = useRef(0);
  const listRef = useRef(null);

  // Escape closes; lock page scroll behind the overlay.
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const useMyLocation = useCallback(
    (silent) => {
      if (!navigator.geolocation) {
        setError('Your browser does not support location.');
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location', gps: true }),
        () => {
          setLoading(false);
          if (!silent) setError('Location access was blocked. Allow it in your browser to route from where you are.');
          else if (!origin) setError('Allow location access so we can plan a route from where you are.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    },
    [origin],
  );

  // No starting point yet → ask for GPS.
  useEffect(() => {
    if (!origin) useMyLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the route whenever start or mode changes.
  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api(`/api/route?from=${origin.lat},${origin.lon}&to=${dest.lat},${dest.lon}&mode=${mode}`)
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setActive(0);
        setFocus(null);
      })
      .catch((e) => !cancelled && (setRoute(null), setError(e.message)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [origin, mode, dest.lat, dest.lon]);

  // ── Live navigation ──
  const stopTracking = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    setMe(null);
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  function startTracking() {
    if (!navigator.geolocation) return setError('Your browser does not support location.');
    setArrived(false);
    setTracking(true);
    setFocus(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, follow: true }),
      () => {
        stopTracking();
        setError('Location access was blocked, so live navigation is unavailable.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  // Work out the current step, arrival, and reroute when off course.
  useEffect(() => {
    if (!me || !route) return;
    if (haversine(me.lat, me.lon, dest.lat, dest.lon) < 25) {
      setArrived(true);
      setActive(route.steps.length - 1);
      return;
    }
    // Reroute if we've wandered more than ~60 m from the line (at most every 15 s).
    if (distanceToRoute(me, route.coords) > 60 && Date.now() - lastReroute.current > 15000) {
      lastReroute.current = Date.now();
      toast('Off route — recalculating');
      setOrigin({ lat: me.lat, lon: me.lon, label: 'Your location', gps: true });
      return;
    }
    // Upcoming maneuver = nearest maneuver point; move past it once we're within 15 m.
    let idx = 0;
    let best = Infinity;
    route.steps.forEach((s, i) => {
      const d = haversine(me.lat, me.lon, s.lat, s.lon);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    if (best < 15 && idx < route.steps.length - 1) idx += 1;
    setActive(idx);
  }, [me, route, dest.lat, dest.lon, toast]);

  // Keep the active step in view.
  useEffect(() => {
    if (!tracking) return;
    listRef.current?.querySelector(`[data-step="${active}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [active, tracking]);

  const remaining = useMemo(() => {
    if (!route) return null;
    if (!tracking || !me) return { distance: route.distance, duration: route.duration };
    // Each step's distance is the leg *after* its maneuver, so: distance to the next maneuver + every leg from there on.
    const next = route.steps[active];
    const toNext = next ? haversine(me.lat, me.lon, next.lat, next.lon) : 0;
    const speed = route.distance ? route.duration / route.distance : 0.75;
    const distance = toNext + route.steps.slice(active).reduce((n, s) => n + s.distance, 0);
    return { distance, duration: distance * speed, toNext };
  }, [route, tracking, me, active]);

  const current = route?.steps?.[active];
  const arriveAt = remaining ? new Date(Date.now() + remaining.duration * 1000) : null;
  const straightLine = origin ? haversine(origin.lat, origin.lon, dest.lat, dest.lon) : null;

  return (
    <div className="fixed inset-0 z-[2200] bg-surface flex flex-col" role="dialog" aria-modal="true" aria-label={`Directions to ${dest.name}`}>
      {/* Top bar */}
      <div className="shrink-0 bg-surface/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(44,24,16,0.08)]">
        <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="w-10 h-10 shrink-0 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" aria-label="Close directions">
              <Icon name="arrow_back" />
            </button>
            <div className="min-w-0">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Directions to</p>
              <h2 className="font-headline-sm text-headline-sm text-primary truncate">{dest.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-surface-container-low shadow-sm">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                aria-pressed={mode === m.key}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-label-md transition-colors ${
                  mode === m.key ? 'bg-primary-container text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon name={m.icon} className="text-lg" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 max-w-[1360px] w-full mx-auto lg:px-margin-desktop lg:py-space-md lg:gap-5">
        {/* Map */}
        <div className="relative h-[42vh] lg:h-auto lg:col-span-8 lg:order-2 lg:rounded-2xl overflow-hidden shadow-xl bg-surface-container shrink-0">
          <RouteMap
            coords={route?.coords}
            from={origin}
            to={dest}
            me={me}
            focus={focus}
            mode={mode}
            mapStyle={settings.mapStyle}
            toLabel={dest.name}
          />
          {tracking && current && !arrived && (
            <div className="absolute top-3 inset-x-3 z-[500] flex justify-center pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary-container text-on-primary shadow-2xl max-w-md w-full">
                <span className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Icon name={current.icon} className="text-2xl" />
                </span>
                <div className="min-w-0">
                  <p className="font-title-sm text-title-sm leading-snug">{current.text}</p>
                  {remaining?.toNext != null && (
                    <p className="font-label-md text-label-md text-on-primary-container">in {formatDistance(remaining.toNext, units)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {arrived && (
            <div className="absolute top-3 inset-x-3 z-[500] flex justify-center">
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed-variant shadow-2xl">
                <Icon name="celebration" className="text-2xl" />
                <p className="font-title-sm text-title-sm">You&apos;ve arrived at {dest.name}. Enjoy your coffee!</p>
              </div>
            </div>
          )}
        </div>

        {/* Panel */}
        <aside className="flex-1 min-h-0 lg:col-span-4 lg:order-1 flex flex-col bg-surface-container-lowest lg:rounded-2xl lg:shadow-xl overflow-hidden">
          <div className="p-4 md:p-5 bg-surface-container-low space-y-3 shrink-0">
            {/* From / To */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <span className="w-3 h-3 rounded-full ring-[3px] ring-primary-container bg-surface-container-lowest" />
                <span className="flex-1 w-0.5 my-1 bg-outline-variant" />
                <Icon name="local_cafe" fill className="text-secondary text-base" />
              </div>
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">From</p>
                    <p className="font-title-sm text-title-sm text-on-surface truncate">{origin?.label || 'Finding your location…'}</p>
                  </div>
                  {!origin?.gps && (
                    <button onClick={() => useMyLocation(false)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-variant font-label-sm text-label-sm text-secondary">
                      <Icon name="my_location" className="text-sm" /> Use my location
                    </button>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">To</p>
                  <p className="font-title-sm text-title-sm text-on-surface truncate">{dest.name}</p>
                  {dest.address && <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{dest.address}</p>}
                </div>
              </div>
            </div>

            {/* Summary */}
            {route && remaining && (
              <div className="flex items-end justify-between gap-3 bg-surface-container-lowest rounded-xl p-3.5 shadow-sm">
                <div>
                  <p className="font-headline-lg-mobile text-headline-lg-mobile text-primary leading-none">{fmtDuration(remaining.duration)}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">
                    {formatDistance(remaining.distance, units)} • Arrive around {fmtClock(arriveAt)}
                  </p>
                </div>
                <Icon name={MODES.find((m) => m.key === mode).icon} className="text-3xl text-secondary" />
              </div>
            )}

            {route &&
              (tracking ? (
                <button onClick={stopTracking} className="w-full px-4 py-3 rounded-full bg-error-container text-on-error-container font-label-lg text-label-lg flex items-center justify-center gap-2">
                  <Icon name="stop_circle" /> Stop navigation
                </button>
              ) : (
                <button onClick={startTracking} className="w-full px-4 py-3 rounded-full bg-secondary text-on-secondary font-label-lg text-label-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <Icon name="navigation" fill /> Start live navigation
                </button>
              ))}
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-1">
            {loading && (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                    <div className="flex-1 h-4 rounded-full bg-surface-container-high" />
                  </div>
                ))}
              </div>
            )}
            {error && !loading && (
              <div className="p-3.5 rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex gap-2">
                <Icon name="error" className="text-base mt-0.5" />
                <div className="flex-1">
                  {error}
                  {straightLine != null && (
                    <p className="mt-1 opacity-80">Straight-line distance: {formatDistance(straightLine, units)}.</p>
                  )}
                </div>
              </div>
            )}
            {!loading && route && (
              <ol className="space-y-1">
                {route.steps.map((s, i) => {
                  const isActive = tracking ? i === active : focus?.key === i;
                  const done = tracking && i < active;
                  return (
                    <li key={i} data-step={i}>
                      <button
                        onClick={() => setFocus({ lat: s.lat, lon: s.lon, key: i })}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                          isActive ? 'bg-secondary-container/50' : 'hover:bg-surface-container-low'
                        } ${done ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            s.type === 'arrive'
                              ? 'bg-primary-container text-secondary-container'
                              : isActive
                                ? 'bg-secondary text-on-secondary'
                                : 'bg-surface-container text-secondary'
                          }`}
                        >
                          <Icon name={s.icon} fill={s.type === 'arrive'} className="text-lg" />
                        </span>
                        <span className="flex-1 min-w-0 pt-0.5">
                          <span className="block font-body-md text-body-md text-on-surface leading-snug">{s.text}</span>
                          {s.distance > 0 && s.type !== 'arrive' && (
                            <span className="block font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                              {formatDistance(s.distance, units)} • {fmtDuration(s.duration)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="shrink-0 px-4 py-3 bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
            <Icon name="route" className="text-sm text-secondary" />
            Routes from OSRM on OpenStreetMap data. Check signs and stay safe.
          </div>
        </aside>
      </div>
    </div>
  );
}
