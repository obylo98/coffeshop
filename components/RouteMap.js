'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_LAYERS } from './ShopMap';

const destIcon = L.divIcon({
  className: '',
  iconSize: [44, 52],
  iconAnchor: [22, 50],
  html: `<div class="flex flex-col items-center">
    <div class="w-11 h-11 rounded-full bg-primary-container shadow-xl flex items-center justify-center ring-2 ring-white">
      <span class="material-symbols-outlined fill-1 text-xl text-secondary-container">local_cafe</span>
    </div>
    <div class="w-3 h-3 bg-primary-container rotate-45 -mt-1.5"></div>
  </div>`,
});

const startIcon = L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<span class="block w-[18px] h-[18px] rounded-full bg-surface-container-lowest ring-[5px] ring-primary-container shadow"></span>',
});

const meIcon = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: `<div class="relative w-[26px] h-[26px]">
    <span class="absolute inset-0 rounded-full bg-secondary/40 rr-ping"></span>
    <span class="absolute inset-[4px] rounded-full bg-secondary ring-[3px] ring-white shadow-lg"></span>
  </div>`,
});

const stepIcon = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<span class="block w-[14px] h-[14px] rounded-full bg-secondary-container ring-2 ring-white shadow"></span>',
});

export default function RouteMap({ coords, from, to, me, focus, mode = 'foot', mapStyle = 'warm', toLabel, onReady }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef(null);
  const endsRef = useRef(null);
  const meRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    const map = L.map(ref.current, { zoomControl: false }).setView([to.lat, to.lon], 16);
    const cfg = TILE_LAYERS[mapStyle] || TILE_LAYERS.warm;
    L.tileLayer(cfg.url, {
      maxZoom: cfg.max,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Routing &copy; <a href="https://routing.openstreetmap.de">FOSSGIS OSRM</a>',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    endsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    onReady?.(map);
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // Route line + endpoints
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current.clearLayers();
    endsRef.current.clearLayers();
    L.marker([to.lat, to.lon], { icon: destIcon, zIndexOffset: 800 })
      .bindTooltip(toLabel || 'Destination', { direction: 'top', offset: [0, -46] })
      .addTo(endsRef.current);
    if (from) L.marker([from.lat, from.lon], { icon: startIcon, zIndexOffset: 700 }).bindTooltip('Start').addTo(endsRef.current);
    if (coords?.length) {
      L.polyline(coords, { color: '#ffffff', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(routeRef.current);
      L.polyline(coords, {
        color: '#97472e',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: mode === 'foot' ? '0.1 11' : null,
      }).addTo(routeRef.current);
      map.fitBounds(L.latLngBounds(coords), { padding: [56, 56], maxZoom: 18 });
    } else if (from) {
      map.fitBounds(L.latLngBounds([from.lat, from.lon], [to.lat, to.lon]), { padding: [56, 56], maxZoom: 17 });
    }
  }, [coords, from?.lat, from?.lon, to.lat, to.lon, mode, toLabel, mapStyle]);

  // Live position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!me) {
      meRef.current?.remove();
      meRef.current = null;
      return;
    }
    if (!meRef.current) meRef.current = L.marker([me.lat, me.lon], { icon: meIcon, zIndexOffset: 1000 }).addTo(map);
    else meRef.current.setLatLng([me.lat, me.lon]);
    if (me.follow) map.panTo([me.lat, me.lon], { animate: true });
  }, [me]);

  // Focus a step
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    focusRef.current?.remove();
    focusRef.current = L.marker([focus.lat, focus.lon], { icon: stepIcon, zIndexOffset: 900 }).addTo(map);
    map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 18), { duration: 0.5 });
  }, [focus]);

  return <div ref={ref} className={`absolute inset-0 map-${mapStyle}`} />;
}
