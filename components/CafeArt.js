// Generated cover art for a café. OpenStreetMap has no photos, so instead of
// stock imagery each café gets a stable warm gradient + monogram from its id.

const PALETTES = [
  ['#3e2723', '#97472e'],
  ['#5b403c', '#c86d51'],
  ['#271310', '#745853'],
  ['#793019', '#fe997a'],
  ['#3d4c05', '#899c4f'],
  ['#2b1613', '#d97736'],
];

function hash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ICONS = ['local_cafe', 'coffee', 'coffee_maker', 'emoji_food_beverage', 'bakery_dining'];

export default function CafeArt({ id, name = '', kind = '', className = '', compact = false, children }) {
  const h = hash(id || name);
  const [a, b] = PALETTES[h % PALETTES.length];
  const icon = /bakery/i.test(kind) ? 'bakery_dining' : /roast/i.test(kind) ? 'local_fire_department' : ICONS[h % 3];
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `radial-gradient(120% 90% at 20% 15%, ${b} 0%, ${a} 70%)` }}
    >
      {/* subtle linen/grain texture */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 6px)' }}
      />
      <span
        aria-hidden="true"
        className="material-symbols-outlined absolute text-white/15 select-none"
        style={{ fontSize: compact ? 64 : 180, right: compact ? -10 : -20, bottom: compact ? -14 : -40 }}
      >
        {icon}
      </span>
      {compact ? (
        <div className="absolute inset-0 flex items-center justify-center font-headline-sm text-headline-sm text-white/90">
          {initials || '☕'}
        </div>
      ) : null}
      {children}
    </div>
  );
}
