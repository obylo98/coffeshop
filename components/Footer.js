import { Logo } from './Header';

export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-low shadow-[0_-1px_6px_rgba(44,24,16,0.03)] py-space-xl mt-space-2xl mb-16 md:mb-0">
      <div className="max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-space-sm">
          <Logo className="w-7 h-7 opacity-90" />
          <span className="font-headline-sm text-headline-sm text-primary">RoastRoute</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">— Your locally hosted coffee shop finder.</span>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-space-sm md:gap-space-lg">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Self-hosted • Data stays on this machine</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Map data ©{' '}
            <a className="underline hover:text-secondary" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            contributors
          </span>
        </div>
      </div>
    </footer>
  );
}
