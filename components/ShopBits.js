import Icon from './Icon';
import { openStatus, statusLabel } from '@/lib/hours';

export const AMENITIES = [
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi', detail: 'Internet access listed on OpenStreetMap' },
  { key: 'outdoor', label: 'Outdoor Seating', icon: 'deck', detail: 'Tables outside' },
  { key: 'roastery', label: 'Roasts On-Site', icon: 'local_fire_department', detail: 'In-house coffee roaster' },
  { key: 'takeaway', label: 'Takeaway', icon: 'takeout_dining', detail: 'Coffee to go' },
  { key: 'vegan', label: 'Vegan Options', icon: 'eco', detail: 'Plant-based menu items' },
  { key: 'dogs', label: 'Dog Friendly', icon: 'pets', detail: 'Dogs welcome' },
  { key: 'wheelchair', label: 'Step-free Access', icon: 'accessible', detail: 'Wheelchair accessible' },
];

export const amenityList = (a = {}) => AMENITIES.filter((x) => a[x.key]);

/** Sage "Open" / neutral "Closed" pill from an OSM opening_hours string. Renders nothing if unknown. */
export function StatusBadge({ hours, long = false, className = '' }) {
  const st = openStatus(hours);
  if (!st) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
        st.open ? 'bg-tertiary-container text-tertiary-fixed-dim' : 'bg-surface-container-high text-on-surface-variant'
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${st.open ? 'bg-tertiary-fixed-dim' : 'bg-outline'}`} />
      {long ? statusLabel(st) : st.open ? 'Open now' : 'Closed'}
    </span>
  );
}

export function EmptyState({ icon = 'local_cafe', title, body, children }) {
  return (
    <div className="flex flex-col items-center justify-center p-space-xl md:p-space-2xl bg-surface-container-lowest rounded-xl text-center space-y-space-md">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
        <Icon name={icon} className="text-3xl" />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="font-headline-sm text-headline-sm text-primary">{title}</h3>
        {body && <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>}
      </div>
      {children}
    </div>
  );
}
