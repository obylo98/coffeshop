'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistance, walkMinutes } from '@/lib/geo';
import { openStatus, statusLabel } from '@/lib/hours';

export const TILE_LAYERS = {
  warm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19 },
  mono: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19 },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17 },
};
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
  ' | Topo &copy; <a href="https://opentopomap.org">OpenTopoMap</a>';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function pinIcon(kind) {
  if (kind === 'selected') {
    return L.divIcon({
      className: '',
      iconSize: [44, 52],
      iconAnchor: [22, 50],
      popupAnchor: [0, -46],
      html: `<div class="flex flex-col items-center">
        <div class="relative flex items-center justify-center">
          <span class="absolute w-9 h-9 rounded-full bg-secondary/40 rr-ping"></span>
          <div class="w-11 h-11 rounded-full bg-primary-container shadow-xl flex items-center justify-center ring-2 ring-white">
            <span class="material-symbols-outlined fill-1 text-xl text-secondary-container">local_cafe</span>
          </div>
        </div>
        <div class="w-3 h-3 bg-primary-container rotate-45 -mt-1.5"></div>
      </div>`,
    });
  }
  const fav = kind === 'favorite';
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
    html: `<div class="w-[34px] h-[34px] rounded-full ${
      fav ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-secondary-container'
    } ring-2 ring-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
      <span class="material-symbols-outlined fill-1 text-[18px]">${fav ? 'favorite' : 'local_cafe'}</span>
    </div>`,
  });
}

const youIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div class="relative w-[22px] h-[22px]">
    <span class="absolute inset-0 rounded-full bg-tertiary-fixed-dim/60 rr-ping"></span>
    <span class="absolute inset-[3px] rounded-full bg-tertiary-container ring-[3px] ring-white shadow"></span>
  </div>`,
});

function popupHtml(shop, units) {
  const st = openStatus(shop.openingHours);
  const badge = st
    ? `<span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full font-bold ${
        st.open ? 'bg-tertiary-container text-tertiary-fixed-dim' : 'bg-surface-container-high text-on-surface-variant'
      }">${st.open ? 'Open' : 'Closed'}</span>`
    : '';
  const dist =
    shop.distance != null
      ? `<div class="flex items-center gap-1.5 text-secondary font-semibold"><span class="material-symbols-outlined text-sm">directions_walk</span><span>${walkMinutes(
          shop.distance,
        )} min walk (${formatDistance(shop.distance, units)})</span></div>`
      : `<span class="text-on-surface-variant">${esc(shop.address || '')}</span>`;
  return `
    <div class="relative h-24 w-full bg-primary-container" style="background:radial-gradient(120% 90% at 20% 15%,#97472e 0%,#3e2723 70%)">
      <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
      <div class="absolute bottom-2 left-3 right-8 text-white">
        <p class="font-headline-sm text-[19px] leading-tight truncate">${esc(shop.name)}</p>
        <p class="font-body-sm text-body-sm text-white/80 truncate">${esc(
          [shop.kind, shop.neighborhood].filter(Boolean).join(' · '),
        )}</p>
      </div>
    </div>
    <div class="p-3 flex flex-col gap-2.5">
      <div class="flex items-center justify-between gap-2 font-body-sm text-body-sm">${dist}${badge}</div>
      ${st ? `<p class="font-body-sm text-body-sm text-on-surface-variant -mt-1">${esc(statusLabel(st))}</p>` : ''}
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button type="button" data-directions="${esc(shop.id)}" class="w-full py-1.5 px-2 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 shadow-sm">
          <span class="material-symbols-outlined text-sm">navigation</span>Directions
        </button>
        <a href="/shop/${shop.id}" data-details="${esc(shop.id)}" class="w-full py-1.5 px-2 rounded-full bg-surface-container-high !text-primary font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 no-underline">
          Details<span class="material-symbols-outlined text-xs">chevron_right</span>
        </a>
      </div>
    </div>`;
}

export default function ShopMap({
  center,
  shops = [],
  favorites = [],
  selectedId,
  onSelect,
  onDetails,
  onDirections,
  onReady,
  onMoveEnd,
  mapStyle = 'warm',
  units = 'km',
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileRef = useRef(null);
  const layerRef = useRef(null);
  const youRef = useRef(null);
  const markersRef = useRef(new Map());
  const cbRef = useRef({});
  cbRef.current = { onSelect, onDetails, onMoveEnd, onDirections };

  // Create the map once.
  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      center ? [center.lat, center.lon] : [20, 0],
      center ? 15 : 2,
    );
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('popupopen', (e) => {
      e.popup
        .getElement()
        ?.querySelectorAll('[data-details]')
        .forEach((a) =>
          a.addEventListener('click', (ev) => {
            if (cbRef.current.onDetails) {
              ev.preventDefault();
              cbRef.current.onDetails(a.dataset.details);
            }
          }),
        );
      e.popup
        .getElement()
        ?.querySelectorAll('[data-directions]')
        .forEach((b) => b.addEventListener('click', () => cbRef.current.onDirections?.(b.dataset.directions)));
    });
    map.on('moveend', () => cbRef.current.onMoveEnd?.(map.getCenter()));
    onReady?.(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cfg = TILE_LAYERS[mapStyle] || TILE_LAYERS.warm;
    tileRef.current?.remove();
    tileRef.current = L.tileLayer(cfg.url, { maxZoom: cfg.max, attribution: ATTRIBUTION }).addTo(map);
    tileRef.current.bringToBack();
  }, [mapStyle]);

  // Recentre on the search location.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView([center.lat, center.lon], Math.max(map.getZoom(), 15));
    youRef.current?.remove();
    youRef.current = L.marker([center.lat, center.lon], { icon: youIcon, zIndexOffset: 1000, keyboard: false })
      .bindTooltip(center.source === 'gps' ? 'You are here' : center.short || center.label || 'Search centre')
      .addTo(map);
  }, [center]);

  // Markers for nearby shops + favourites that aren't in the results.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    const favIds = new Set(favorites.map((f) => f.id));
    const all = [...shops, ...favorites.filter((f) => !shops.some((s) => s.id === f.id))];
    for (const shop of all) {
      const kind = shop.id === selectedId ? 'selected' : favIds.has(shop.id) ? 'favorite' : 'normal';
      const marker = L.marker([shop.lat, shop.lon], {
        icon: pinIcon(kind),
        zIndexOffset: kind === 'selected' ? 900 : kind === 'favorite' ? 500 : 0,
        title: shop.name,
      })
        .bindPopup(popupHtml(shop, units), { className: 'rr-popup', maxWidth: 300, minWidth: 288 })
        .on('click', () => cbRef.current.onSelect?.(shop.id));
      marker.addTo(layer);
      markersRef.current.set(shop.id, marker);
    }
  }, [shops, favorites, selectedId, units]);

  // Fly to the selected shop.
  useEffect(() => {
    const marker = markersRef.current.get(selectedId);
    const map = mapRef.current;
    if (!marker || !map) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.6 });
    marker.openPopup();
  }, [selectedId]);

  return <div ref={containerRef} className={`absolute inset-0 map-${mapStyle} ${className}`} />;
}
