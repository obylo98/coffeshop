'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from './Icon';
import { useApp } from './Providers';
import { formatDistance, haversine, walkMinutes } from '@/lib/geo';

const MiniMap = dynamic(() => import('./MiniMap'), { ssr: false });

const LABEL = 'font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider';
const INPUT =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-on-surface-variant/70';

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

function ModalShell({ onClose, children, wide = false }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface-container-lowest w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl p-space-lg md:p-space-xl shadow-2xl space-y-space-md my-auto border border-outline-variant/30`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ chip, chipIcon = 'coffee', title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between pb-space-xs border-b border-surface-container-high/60 gap-3">
      <div className="space-y-1 min-w-0">
        {chip && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
            <Icon name={chipIcon} className="text-xs" />
            <span>{chip}</span>
          </div>
        )}
        <h3 className="font-headline-sm text-headline-sm text-primary tracking-tight">{title}</h3>
        {subtitle && <div className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">{subtitle}</div>}
      </div>
      <button className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors shrink-0" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

/* ───────────────────────── Edit note & tags ───────────────────────── */

export function NoteModal({ fav, onClose }) {
  const { updateFavorite } = useApp();
  const [note, setNote] = useState(fav.note || '');
  const [tags, setTags] = useState((fav.tags || []).map((t) => `#${t}`).join(', '));
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await updateFavorite(fav.id, { note, tags: tags.split(',') });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={save} className="space-y-space-md">
        <ModalHeader chip="Personal Note" chipIcon="edit_note" title={fav.name} subtitle={<span>Saved to your account on this server</span>} onClose={onClose} />
        <label className="block space-y-1.5">
          <span className={LABEL}>Personal Tasting or Workspace Note</span>
          <textarea
            className={`${INPUT} font-serif italic text-body-md leading-relaxed`}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Secret seating in the back, best flat white in the area, fast Wi-Fi near the window..."
            autoFocus
          />
        </label>
        <label className="block space-y-1.5">
          <span className={LABEL}>Tags</span>
          <input className={INPUT} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#QuietWork, #PourOver, #WeekendOnly" />
          <span className="font-body-sm text-body-sm text-on-surface-variant">Separate tags with commas. They become filter pills on your favourites page.</span>
        </label>
        <div className="pt-space-sm flex items-center justify-end gap-space-sm">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md shadow-sm hover:opacity-95 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ───────────────────────── Cupping note ───────────────────────── */

const ROASTS = ['Light / Nordic', 'Medium-Light', 'Omni Roast', 'Dark Espresso'];
const METHODS = ['V60 Pour-Over', 'Aeropress', 'Kalita Wave', 'Espresso 1:2', 'Chemex', 'Flat White', 'Cold Brew'];
const SCORES = [
  { key: 'acidity', label: 'Acidity', hint: 'Bright & citric' },
  { key: 'sweetness', label: 'Sweetness', hint: 'Syrupy, honeyed' },
  { key: 'body', label: 'Body', hint: 'Tea-like → heavy' },
  { key: 'aftertaste', label: 'Cleanliness / Aftertaste', hint: 'Lingering finish' },
];

export function CuppingModal({ fav, entry, onClose }) {
  const { saveCupping } = useApp();
  const [form, setForm] = useState(
    entry ?? {
      bean: '',
      roastProfile: 'Medium-Light',
      roastDate: '',
      method: 'V60 Pour-Over',
      temp: '',
      ratio: '',
      descriptors: [],
      scores: { acidity: 3, sweetness: 3, body: 3, aftertaste: 3 },
      journal: '',
    },
  );
  const [descriptor, setDescriptor] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addDescriptor = () => {
    const d = descriptor.trim();
    if (d && !form.descriptors.includes(d)) set('descriptors', [...form.descriptors, d]);
    setDescriptor('');
  };

  async function save() {
    setBusy(true);
    const ok = await saveCupping(fav.id, form);
    setBusy(false);
    if (ok) onClose();
  }

  const chip = (active, accent) =>
    `px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors ${
      active
        ? accent
          ? 'bg-secondary text-on-secondary font-semibold'
          : 'bg-primary-container text-on-primary shadow-sm'
        : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
    }`;

  return (
    <ModalShell onClose={onClose} wide>
      <ModalHeader
        chip={fav.kind || 'Café'}
        title={entry ? 'Edit Cupping Note' : 'Add Cupping Note & Tasting Log'}
        subtitle={
          <>
            <Icon name="dns" className="text-xs text-secondary" />
            <span>
              Saved to your account for <strong>{fav.name}</strong>
            </span>
          </>
        }
        onClose={onClose}
      />

      <div className="space-y-space-md max-h-[64vh] overflow-y-auto pr-1">
        <label className="block space-y-1.5">
          <span className={LABEL}>Single Origin / Bean Lot Name</span>
          <input className={`${INPUT} font-body-md text-body-md text-primary`} value={form.bean} onChange={(e) => set('bean', e.target.value)} placeholder="e.g. Ethiopia Sidama Natural — Lot #402" autoFocus />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div className="space-y-1.5">
            <span className={LABEL}>Roast Profile</span>
            <div className="flex flex-wrap gap-1.5">
              {ROASTS.map((r) => (
                <button key={r} type="button" className={chip(form.roastProfile === r)} onClick={() => set('roastProfile', r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className={LABEL}>Roast Date</span>
            <input type="date" className={INPUT} value={form.roastDate} onChange={(e) => set('roastDate', e.target.value)} />
          </label>
        </div>

        <div className="bg-surface-container-low/60 p-space-md rounded-xl space-y-space-sm">
          <span className={`${LABEL} block`}>Brew Method & Extraction Spec</span>
          <div className="flex flex-wrap gap-1.5">
            {METHODS.map((m) => (
              <button key={m} type="button" className={chip(form.method === m, true)} onClick={() => set('method', m)}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1">
            <label className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg">
              <Icon name="thermostat" className="text-xs text-secondary" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">Temp:</span>
              <input className="flex-1 min-w-0 bg-transparent font-label-sm text-label-sm font-semibold text-primary focus:outline-none" value={form.temp} onChange={(e) => set('temp', e.target.value)} placeholder="93°C / 200°F" />
            </label>
            <label className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg">
              <Icon name="scale" className="text-xs text-secondary" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">Ratio:</span>
              <input className="flex-1 min-w-0 bg-transparent font-label-sm text-label-sm font-semibold text-primary focus:outline-none" value={form.ratio} onChange={(e) => set('ratio', e.target.value)} placeholder="1:16.5 (15g : 248g)" />
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className={LABEL}>Cupping Flavor Descriptors</span>
          <div className="flex flex-wrap gap-1.5 items-center">
            {form.descriptors.map((d) => (
              <span key={d} className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold flex items-center gap-1">
                {d}
                <button type="button" aria-label={`Remove ${d}`} onClick={() => set('descriptors', form.descriptors.filter((x) => x !== d))}>
                  <Icon name="close" className="text-xs" />
                </button>
              </span>
            ))}
            <span className="inline-flex items-center rounded-full bg-surface-container pl-3 pr-1 py-0.5">
              <input
                value={descriptor}
                onChange={(e) => setDescriptor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addDescriptor();
                  }
                }}
                placeholder="Bergamot, Peach…"
                className="w-28 bg-transparent font-label-sm text-label-sm text-on-surface focus:outline-none"
              />
              <button type="button" onClick={addDescriptor} className="px-2 py-0.5 rounded-full text-secondary font-label-sm text-label-sm font-medium hover:bg-surface-container-high">
                + Add Note
              </button>
            </span>
          </div>
        </div>

        <div className="space-y-space-xs bg-surface-container-low p-space-md rounded-xl">
          <span className={`${LABEL} block`}>Sensory Evaluation Scores</span>
          <div className="space-y-2 pt-1">
            {SCORES.map((s) => (
              <label key={s.key} className="block">
                <div className="flex items-center justify-between text-label-sm font-label-sm">
                  <span className="text-primary">
                    {s.label} <span className="text-on-surface-variant font-normal">({s.hint})</span>
                  </span>
                  <span className="font-mono font-bold text-secondary">{Number(form.scores[s.key]).toFixed(1)} / 5.0</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.scores[s.key]}
                  onChange={(e) => set('scores', { ...form.scores, [s.key]: Number(e.target.value) })}
                  className="w-full accent-[var(--color-secondary)] cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className={LABEL}>Personal Tasting & Journal Entry</span>
          <textarea
            className={`${INPUT} text-primary leading-relaxed`}
            rows={3}
            value={form.journal}
            onChange={(e) => set('journal', e.target.value)}
            placeholder="Aroma, acidity, finish — and how you'd brew it next time."
          />
        </label>

        <div className="p-space-sm rounded-lg bg-surface-container-high/40 flex items-center gap-space-xs text-on-surface-variant">
          <Icon name="lock" className="text-secondary text-sm" />
          <p className="font-body-sm text-xs">Stored in your account on this self-hosted server (data/db.json). Nothing is sent to a cloud service.</p>
        </div>
      </div>

      <div className="pt-space-sm flex items-center justify-between border-t border-surface-container-high/60">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-5 py-2.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-60"
        >
          <Icon name="check_circle" className="text-base" />
          <span>{busy ? 'Saving…' : 'Save Cupping Note to Log'}</span>
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────────────────────── Add custom spot drawer ───────────────────────── */

export function AddSpotDrawer({ open, onClose }) {
  const { saveFavorite } = useApp();
  const [form, setForm] = useState({ name: '', address: '', tags: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  useEscape(onClose);

  useEffect(() => {
    const t = setTimeout(() => setShown(open), 10);
    return () => clearTimeout(t);
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const saved = await saveFavorite({ custom: true, ...form, tags: form.tags.split(',') });
    setBusy(false);
    if (saved) {
      setForm({ name: '', address: '', tags: '', note: '' });
      onClose();
    }
  }

  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-[2000] bg-primary/20 backdrop-blur-xs flex justify-end transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg bg-surface-container-lowest h-full shadow-2xl p-space-lg md:p-space-xl flex flex-col justify-between overflow-y-auto transition-transform duration-300 ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-space-lg">
          <div className="flex items-center justify-between pb-space-sm">
            <div className="space-y-0.5">
              <h3 className="font-headline-md text-headline-md text-primary">Add Secret Spot</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">A café that isn&apos;t on the map yet — saved straight to your favourites.</p>
            </div>
            <button className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <form className="space-y-space-md" onSubmit={submit}>
            <label className="block space-y-1.5">
              <span className={LABEL}>Spot or Cafe Name</span>
              <input className={INPUT} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hearth & Stone Micro-Roaster" />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL}>Neighborhood / Address</span>
              <input className={INPUT} required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. 448 Pine St, Arts District, Portland" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">We look this up on OpenStreetMap to place the pin.</span>
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL}>Brew Specialties & Tags</span>
              <input className={INPUT} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. #Aeropress, #SunlitWorkspace, #NaturalProcess" />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL}>Personal Tasting or Workspace Note</span>
              <textarea className={INPUT} rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Secret seating in the back, roasts fresh every Tuesday morning..." />
            </label>
            <div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-xs text-on-surface-variant">
              <Icon name="verified_user" className="text-secondary text-sm mt-0.5" />
              <p className="font-body-sm text-body-sm">Saved to your account on this self-hosted server. It persists across restarts and never leaves your machine.</p>
            </div>
            <div className="pt-space-md flex items-center justify-end gap-space-sm">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md hover:opacity-95 shadow-sm disabled:opacity-60">
                {busy ? 'Locating…' : 'Save Spot'}
              </button>
            </div>
          </form>
        </div>
        <div className="pt-space-lg text-center font-label-sm text-label-sm text-on-surface-variant">RoastRoute • Self-hosted • Your data stays local</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Map snapshot ───────────────────────── */

export function MapModal({ fav, onClose }) {
  const { center, settings, openDirections } = useApp();
  const dist = center ? haversine(center.lat, center.lon, fav.lat, fav.lon) : null;
  return (
    <ModalShell onClose={onClose} wide>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">{fav.name}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{fav.address || fav.neighborhood || 'Saved location'}</p>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="w-full h-80 rounded-xl overflow-hidden relative shadow-inner bg-surface-container">
        <MiniMap lat={fav.lat} lon={fav.lon} from={dist != null && dist < 50000 ? center : null} mapStyle={settings.mapStyle} label={fav.name} />
        {dist != null && (
          <div className="absolute bottom-3 left-3 z-[500] bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <Icon name="navigation" className="text-secondary text-sm" />
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              {formatDistance(dist, settings.units)} from {center.short || 'you'} • {walkMinutes(dist)} min walk
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-space-sm pt-space-xs">
        <button className="px-4 py-2 rounded-full bg-surface-container font-label-md text-label-md text-on-surface" onClick={onClose}>
          Close Snapshot
        </button>
        <button
          onClick={() => {
            onClose();
            openDirections(fav);
          }}
          className="px-5 py-2 rounded-full bg-secondary text-on-secondary font-label-md text-label-md flex items-center gap-1.5"
        >
          <Icon name="directions_walk" className="text-sm" />
          <span>Start Directions</span>
        </button>
      </div>
    </ModalShell>
  );
}
