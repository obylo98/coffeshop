'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, useApp } from '@/components/Providers';
import Icon from '@/components/Icon';
import CafeArt from '@/components/CafeArt';
import { AMENITIES, EmptyState, StatusBadge } from '@/components/ShopBits';
import { CuppingModal, NoteModal } from '@/components/FavoriteModals';
import { formatDistance, haversine, walkMinutes } from '@/lib/geo';
import { openStatus, statusLabel, weeklyTable } from '@/lib/hours';

const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false });

export default function ShopDetailPage() {
  const { type, id: rawId } = useParams();
  const id = `${type}/${rawId}`;
  const app = useApp();
  const { center, settings, getFavorite, isFavorite, toggleFavorite, deleteCupping, confirm, toast, exportFavorites, openDirections } = app;
  const fav = getFavorite(id);
  const [remote, setRemote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(type !== 'custom');
  const [noteOpen, setNoteOpen] = useState(false);
  const [cupping, setCupping] = useState(null); // null | 'new' | entry

  useEffect(() => {
    if (type === 'custom') return;
    let cancelled = false;
    setLoading(true);
    api(`/api/shop?id=${encodeURIComponent(id)}`)
      .then((d) => !cancelled && setRemote(d.shop))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  const shop = remote || fav ? { ...(fav || {}), ...(remote || {}) } : null;
  const saved = isFavorite(id);
  const units = settings.units;

  if (!shop) {
    return (
      <Wrap>
        {loading ? (
          <div className="space-y-space-lg animate-pulse">
            <div className="h-[380px] rounded-xl bg-surface-container-high" />
            <div className="h-40 rounded-xl bg-surface-container-lowest" />
          </div>
        ) : (
          <EmptyState icon="wrong_location" title="Coffee shop not found" body={error || 'This spot could not be loaded.'}>
            <Link href="/" className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
              Back to Explore Map
            </Link>
          </EmptyState>
        )}
      </Wrap>
    );
  }

  const dist = center ? haversine(center.lat, center.lon, shop.lat, shop.lon) : null;
  const status = openStatus(shop.openingHours);
  const table = weeklyTable(shop.openingHours);
  const amenities = AMENITIES.filter((a) => shop.amenities?.[a.key]);
  const today = table?.find((r) => r.today);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard');
    } catch {
      toast(url);
    }
  }

  return (
    <>
      {/* Breadcrumb */}
      <Wrap className="py-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <nav className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant min-w-0">
            <Link className="hover:text-primary transition-colors flex items-center gap-1 shrink-0" href="/">
              <Icon name="arrow_back" className="text-sm" />
              <span>{center?.short || 'Explore Map'}</span>
            </Link>
            <span>/</span>
            <span className="text-primary font-semibold truncate">{shop.name}</span>
          </nav>
          {status && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.open ? 'bg-tertiary-fixed-variant animate-pulse' : 'bg-outline'}`} />
              <span className="font-label-sm text-label-sm text-on-surface-variant">{statusLabel(status)}</span>
            </div>
          )}
        </div>
      </Wrap>

      {/* Hero */}
      <Wrap className="pb-space-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
          <CafeArt id={shop.id} name={shop.name} kind={shop.kind} className="lg:col-span-8 rounded-xl shadow-md min-h-[300px] lg:min-h-[440px]">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md shadow-sm">
                <Icon name="verified" fill className="text-secondary text-base" />
                <span className="font-label-sm text-label-sm text-on-surface">{shop.custom ? 'Your Secret Spot' : 'Listed on OpenStreetMap'}</span>
              </div>
              {shop.amenities?.roastery && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant shadow-sm">
                  <Icon name="local_fire_department" className="text-sm" />
                  <span className="font-label-sm text-label-sm font-semibold">Roasts On-Site</span>
                </div>
              )}
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">
                {[shop.kind, shop.neighborhood].filter(Boolean).join(' · ')}
              </span>
              <p className="font-headline-md text-headline-md md:font-headline-lg md:text-headline-lg text-white mt-1 max-w-2xl">{shop.name}</p>
              {shop.cuisine && <p className="font-body-md text-body-md text-white/80 mt-1">Serves {shop.cuisine}</p>}
            </div>
          </CafeArt>

          {/* Operating hours */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
            <div className="flex items-center justify-between mb-space-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">Operating Hours</h3>
              <Icon name="schedule" className="text-secondary" />
            </div>
            {table ? (
              <>
                <div className={`p-3 rounded-lg mb-space-sm ${status?.open ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface'}`}>
                  <div className="flex items-center justify-between font-label-md text-label-md font-bold gap-2">
                    <span>Today ({today.day})</span>
                    <span className="text-right">{today.text}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-body-sm text-[12px]">
                    <Icon name={status?.open ? 'check_circle' : 'do_not_disturb_on'} className="text-xs" />
                    <span>{statusLabel(status)}</span>
                  </div>
                </div>
                <ul className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
                  {table.map((r) => (
                    <li key={r.day} className={`flex justify-between gap-3 py-1 ${r.today ? 'font-semibold text-primary' : ''}`}>
                      <span>
                        {r.day}
                        {r.today ? ' (Today)' : ''}
                      </span>
                      <span className={r.today ? '' : 'font-medium text-on-surface text-right'}>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : shop.openingHours ? (
              <div className="p-3 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">As listed</p>
                {shop.openingHours}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Opening hours aren&apos;t listed on OpenStreetMap for this café yet.
              </p>
            )}
            <p className="mt-space-md pt-3 font-label-sm text-label-sm text-on-surface-variant">
              Hours come from OpenStreetMap and may be out of date.
            </p>
          </div>
        </div>
      </Wrap>

      {/* Title & actions */}
      <Wrap className="py-space-sm">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary tracking-tight">{shop.name}</h1>
                <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{shop.kind || 'Café'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 font-body-sm text-body-sm text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <Icon name="location_on" className="text-base text-secondary" />
                  <span>{shop.address || shop.fullAddress || shop.neighborhood || 'Address not listed'}</span>
                </div>
                {dist != null && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Icon name="directions_walk" className="text-base text-tertiary-fixed-variant" />
                      <span className="font-medium text-on-surface">
                        {formatDistance(dist, units)} • {walkMinutes(dist)} min walk
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {status && (
              <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2.5 rounded-lg shrink-0">
                <div className={`w-3 h-3 rounded-full ${status.open ? 'bg-tertiary-container shadow-[0_0_8px_rgba(38,49,0,0.4)] animate-pulse' : 'bg-outline'}`} />
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">{statusLabel(status)}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Based on listed opening hours</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-high/40 p-space-md rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => toggleFavorite(shop)}
                aria-pressed={saved}
                className={`px-5 py-3 rounded-full shadow-md transition-all flex items-center gap-2.5 text-left ${
                  saved ? 'bg-secondary text-on-secondary hover:bg-secondary/90' : 'bg-surface-container-lowest text-primary hover:bg-surface-bright'
                }`}
              >
                <Icon name="star" fill={saved} className="text-lg" />
                <span className="flex flex-col">
                  <span className="font-label-md text-label-md font-bold leading-tight">{saved ? '★ Saved in Favorites' : 'Save to Favorites'}</span>
                  <span className="font-label-sm text-label-sm opacity-90 leading-tight">
                    {saved ? 'Stored on your local server — persists across restarts' : 'Keep it, add notes & cupping logs'}
                  </span>
                </span>
              </button>
              <button
                onClick={() => openDirections(shop)}
                className="px-4 py-3 rounded-full bg-primary-container text-on-primary font-label-md text-label-md hover:opacity-95 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Icon name="navigation" className="text-lg text-secondary-container" />
                <span>Get Walking Directions{dist != null ? ` (${formatDistance(dist, units)})` : ''}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={share} className="px-3 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors font-label-sm text-label-sm flex items-center gap-1.5">
                <Icon name="share" className="text-base" /> Share Cafe Card
              </button>
              <button
                onClick={() => exportFavorites([fav || shop], `${shop.name.replace(/[^\w]+/g, '-').toLowerCase()}.json`)}
                className="px-3 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors font-label-sm text-label-sm flex items-center gap-1.5"
              >
                <Icon name="download" className="text-base" /> Export JSON
              </button>
            </div>
          </div>
        </div>
      </Wrap>

      {/* Main split */}
      <Wrap className="py-space-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Personal note + cupping log */}
            <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-space-md">
                <div className="flex items-center gap-2">
                  <Icon name="coffee" className="text-secondary" />
                  <h2 className="font-headline-sm text-headline-sm text-primary">Your Tasting Journal</h2>
                </div>
                {saved && (
                  <div className="flex gap-2">
                    <button onClick={() => setNoteOpen(true)} className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1">
                      <Icon name="edit" className="text-sm" /> {fav?.note ? 'Edit Note' : 'Add Note'}
                    </button>
                    <button onClick={() => setCupping('new')} className="px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md flex items-center gap-1 shadow-sm">
                      <Icon name="add" className="text-sm" /> Cupping Note
                    </button>
                  </div>
                )}
              </div>
              {!saved ? (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Save this café to your favourites to keep a personal note and a cupping log of the coffees you try here.
                </p>
              ) : (
                <div className="space-y-space-md">
                  {fav?.note && (
                    <div className="bg-surface-container-low rounded-lg p-space-md flex gap-space-sm items-start">
                      <Icon name="edit_note" className="text-secondary shrink-0 mt-0.5" />
                      <p className="font-serif text-body-lg text-primary italic leading-snug">“{fav.note}”</p>
                    </div>
                  )}
                  {fav?.cupping?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                      {fav.cupping.map((c) => (
                        <CuppingCard
                          key={c.id}
                          entry={c}
                          onEdit={() => setCupping(c)}
                          onDelete={async () => {
                            if (await confirm({ title: 'Delete this cupping note?', confirmLabel: 'Delete', danger: true })) deleteCupping(fav.id, c.id);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    !fav?.note && (
                      <p className="font-body-md text-body-md text-on-surface-variant">No notes yet. Log your first cup — bean, brew method, flavours and scores.</p>
                    )
                  )}
                </div>
              )}
            </section>

            {/* Amenities */}
            <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
              <div className="flex items-center gap-2 mb-space-md">
                <Icon name="chair" className="text-secondary" />
                <h2 className="font-headline-sm text-headline-sm text-primary">Workspace &amp; Atmosphere</h2>
              </div>
              {amenities.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  {amenities.map((a) => (
                    <div key={a.key} className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low">
                      <span className="w-9 h-9 rounded-full bg-surface-container-lowest flex items-center justify-center text-secondary shrink-0">
                        <Icon name={a.icon} />
                      </span>
                      <div>
                        <p className="font-title-sm text-title-sm text-primary">{a.label}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{a.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  No amenities are tagged for this café on OpenStreetMap. Know it well?{' '}
                  {!shop.custom && (
                    <a
                      className="text-secondary font-semibold underline"
                      href={`https://www.openstreetmap.org/${shop.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Improve it on OpenStreetMap
                    </a>
                  )}
                </p>
              )}
            </section>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {(shop.phone || shop.website || shop.email) && (
              <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="contact_page" className="text-secondary" />
                  <h3 className="font-headline-sm text-headline-sm text-primary">Contact</h3>
                </div>
                {shop.website && (
                  <a href={shop.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-body-sm text-body-sm text-secondary hover:underline break-all">
                    <Icon name="language" className="text-base" /> {shop.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
                {shop.phone && (
                  <a href={`tel:${shop.phone}`} className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface hover:underline">
                    <Icon name="call" className="text-base text-secondary" /> {shop.phone}
                  </a>
                )}
                {shop.email && (
                  <a href={`mailto:${shop.email}`} className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface hover:underline break-all">
                    <Icon name="mail" className="text-base text-secondary" /> {shop.email}
                  </a>
                )}
              </section>
            )}
            <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
              <div className="flex items-center justify-between mb-space-md">
                <h3 className="font-headline-sm text-headline-sm text-primary">Location &amp; Route</h3>
                <StatusBadge hours={shop.openingHours} />
              </div>
              <div className="relative h-64 rounded-lg overflow-hidden bg-surface-container">
                <MiniMap lat={shop.lat} lon={shop.lon} from={dist != null && dist < 50000 ? center : null} mapStyle={settings.mapStyle} label={shop.name} />
              </div>
              <button
                onClick={() => openDirections(shop)}
                className="mt-space-md w-full px-4 py-2.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Icon name="route" className="text-base" /> Show Route &amp; Directions
              </button>
            </section>
          </div>
        </div>
      </Wrap>

      {noteOpen && fav && <NoteModal fav={fav} onClose={() => setNoteOpen(false)} />}
      {cupping && fav && <CuppingModal fav={fav} entry={cupping === 'new' ? null : cupping} onClose={() => setCupping(null)} />}
    </>
  );
}

function Wrap({ children, className = '' }) {
  return <section className={`max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop ${className}`}>{children}</section>;
}

function CuppingCard({ entry, onEdit, onDelete }) {
  const scores = [
    ['Acidity', entry.scores?.acidity],
    ['Sweetness', entry.scores?.sweetness],
    ['Body', entry.scores?.body],
    ['Aftertaste', entry.scores?.aftertaste],
  ];
  return (
    <div className="p-space-md rounded-xl bg-surface-container-low space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {entry.roastProfile && <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">{entry.roastProfile}</span>}
            {entry.method && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">{entry.method}</span>}
          </div>
          <h4 className="font-headline-sm text-[19px] leading-tight text-primary">{entry.bean || 'Untitled cup'}</h4>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
            Logged {new Date(entry.createdAt).toLocaleDateString()}
            {entry.roastDate ? ` • Roasted ${new Date(entry.roastDate).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Edit cupping note">
            <Icon name="edit" className="text-base" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-full hover:bg-error-container/50 text-on-surface-variant hover:text-error" aria-label="Delete cupping note">
            <Icon name="delete" className="text-base" />
          </button>
        </div>
      </div>
      {entry.descriptors?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.descriptors.map((d) => (
            <span key={d} className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm">
              {d}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {scores.map(([label, v]) => (
          <div key={label} className="flex items-center gap-2 font-label-sm text-label-sm">
            <span className="w-20 text-on-surface-variant">{label}</span>
            <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full" style={{ width: `${((v || 0) / 5) * 100}%` }} />
            </div>
            <span className="font-mono text-secondary w-7 text-right">{Number(v || 0).toFixed(1)}</span>
          </div>
        ))}
      </div>
      {(entry.temp || entry.ratio) && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">{[entry.temp, entry.ratio].filter(Boolean).join(' • ')}</p>
      )}
      {entry.journal && <p className="font-body-sm text-body-sm text-on-surface italic">{entry.journal}</p>}
    </div>
  );
}
