// Minimal parser for OpenStreetMap `opening_hours` values.
// Handles the common forms: "24/7", "Mo-Fr 07:00-18:00; Sa,Su 08:00-16:00",
// "Mo-Sa 08:00-12:00,13:00-18:00; Su off", "07:00-19:00".
// Anything it can't understand returns null so the UI can fall back to the raw text.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseDays(sel) {
  const out = new Set();
  for (const part of sel.split(',')) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === b) break;
    }
  }
  return [...out];
}

function toMin(t) {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function parseTimes(str) {
  if (/^(off|closed)$/i.test(str)) return [];
  const ranges = [];
  for (const part of str.split(',')) {
    const m = part.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/);
    if (!m) return null;
    const start = toMin(m[1]);
    let end = toMin(m[2]);
    if (start == null || end == null) return null;
    if (end <= start) end += 1440; // runs past midnight
    ranges.push([start, end]);
  }
  return ranges;
}

/** Returns an array of 7 day-schedules (Mo..Su), each an array of [startMin, endMin] — or null. */
export function parseOpeningHours(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value === '24/7') return Array.from({ length: 7 }, () => [[0, 1440]]);

  const week = Array.from({ length: 7 }, () => null);
  let understood = false;
  for (const rule of value.split(';').map((r) => r.trim()).filter(Boolean)) {
    if (/^PH\b|^SH\b/.test(rule)) continue; // public/school holidays: ignore
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1].replace(/\s/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    const times = parseTimes(m[2].trim() || 'off');
    if (!days || !times) return null;
    for (const d of days) week[d] = times;
    understood = true;
  }
  if (!understood) return null;
  return week.map((d) => d ?? []);
}

const fmt = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Monday-based weekday index for a Date. */
export const weekdayIndex = (date = new Date()) => (date.getDay() + 6) % 7;

/**
 * Status right now: { open: true, until: '18:00' } | { open: false, opens: 'Tue 07:00' } | null
 */
export function openStatus(raw, now = new Date()) {
  const week = parseOpeningHours(raw);
  if (!week) return null;
  const day = weekdayIndex(now);
  const min = now.getHours() * 60 + now.getMinutes();

  if (week.every((d) => d.length === 1 && d[0][0] === 0 && d[0][1] === 1440)) return { open: true, until: null, always: true };

  for (const [s, e] of week[day]) if (min >= s && min < e) return { open: true, until: fmt(e) };
  const prev = week[(day + 6) % 7];
  for (const [s, e] of prev) if (e > 1440 && min < e - 1440) return { open: true, until: fmt(e) };

  // Find the next opening in the coming week.
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    const starts = week[d].map(([s]) => s).filter((s) => offset > 0 || s > min).sort((a, b) => a - b);
    if (starts.length) {
      const label = offset === 0 ? '' : offset === 1 ? 'tomorrow ' : `${DAY_NAMES[d].slice(0, 3)} `;
      return { open: false, opens: `${label}${fmt(starts[0])}` };
    }
  }
  return { open: false, opens: null };
}

/** Rows for a weekly table: [{ day: 'Monday', text: '07:00 – 18:00', today: bool }] */
export function weeklyTable(raw, now = new Date()) {
  const week = parseOpeningHours(raw);
  if (!week) return null;
  const today = weekdayIndex(now);
  return week.map((ranges, i) => ({
    day: DAY_NAMES[i],
    today: i === today,
    text: ranges.length ? ranges.map(([s, e]) => `${fmt(s)} – ${fmt(e)}`).join(', ') : 'Closed',
  }));
}

export function statusLabel(status) {
  if (!status) return null;
  if (status.open) return status.always ? 'Open 24 hours' : `Open until ${status.until}`;
  return status.opens ? `Closed · opens ${status.opens}` : 'Closed';
}
