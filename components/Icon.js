// Material Symbols Outlined icon (font loaded in app/layout.js).
export default function Icon({ name, fill = false, className = '' }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${fill ? 'fill-1' : ''} ${className}`}>
      {name}
    </span>
  );
}
