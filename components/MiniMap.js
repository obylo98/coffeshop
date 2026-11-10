'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_LAYERS } from './ShopMap';

const pin = L.divIcon({
  className: '',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
  html: `<div class="flex flex-col items-center">
    <div class="w-10 h-10 rounded-full bg-primary-container shadow-xl flex items-center justify-center ring-2 ring-white">
      <span class="material-symbols-outlined fill-1 text-lg text-secondary-container">local_cafe</span>
    </div>
    <div class="w-3 h-3 bg-primary-container rotate-45 -mt-1.5"></div>
  </div>`,
});

const dot = L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<span class="block w-[18px] h-[18px] rounded-full bg-tertiary-container ring-[3px] ring-white shadow"></span>',
});

/** Small, single-location map. `from` (optional) adds the user's position and fits both. */
export default function MiniMap({ lat, lon, from, zoom = 16, mapStyle = 'warm', interactive = true, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    const map = L.map(ref.current, {
      zoomControl: interactive,
      scrollWheelZoom: false,
      dragging: interactive,
      attributionControl: true,
    }).setView([lat, lon], zoom);
    const cfg = TILE_LAYERS[mapStyle] || TILE_LAYERS.warm;
    L.tileLayer(cfg.url, {
      maxZoom: cfg.max,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const m = L.marker([lat, lon], { icon: pin }).addTo(map);
    if (label) m.bindTooltip(label, { direction: 'top', offset: [0, -44] });
    if (from) {
      L.marker([from.lat, from.lon], { icon: dot }).bindTooltip('You').addTo(map);
      L.polyline(
        [
          [from.lat, from.lon],
          [lat, lon],
        ],
        { color: '#97472e', weight: 3, dashArray: '6 8', opacity: 0.8 },
      ).addTo(map);
      map.fitBounds(
        [
          [from.lat, from.lon],
          [lat, lon],
        ],
        { padding: [48, 48], maxZoom: 17 },
      );
    }
    // Container may have been sized after mount (modals, grids).
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      map.remove();
    };
  }, [lat, lon, from?.lat, from?.lon, zoom, mapStyle, interactive, label]);

  return <div ref={ref} className={`absolute inset-0 map-${mapStyle}`} />;
}
