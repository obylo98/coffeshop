'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, useApp } from './Providers';
import Icon from './Icon';

const NAV = [
  { href: '/', label: 'Explore Map', icon: 'explore' },
  { href: '/favorites', label: 'Saved Favorites', icon: 'bookmark' },
  { href: '/settings', label: 'App Settings', icon: 'tune', auth: true },
  { href: '/admin', label: 'Admin', icon: 'admin_panel_settings', admin: true },
];

export function Logo({ className = 'w-9 h-9' }) {
  return (
    <span className={`${className} rounded-full bg-primary-container text-secondary-container flex items-center justify-center shadow-sm shrink-0`}>
      <Icon name="local_cafe" fill className="text-xl" />
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, favorites, logout, openAuth, setCenter, toast } = useApp();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function search(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const place = await api(`/api/geocode?q=${encodeURIComponent(q)}`);
      setCenter({ lat: place.lat, lon: place.lon, label: place.label, short: place.short, source: 'search', at: Date.now() });
      setQ('');
      if (pathname !== '/') router.push('/');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const nav = NAV.filter((n) => (!n.auth || user) && (!n.admin || user?.role === 'admin'));
  const active = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <header className="fixed top-0 w-full z-[1500] bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(44,24,16,0.06)]">
        <div className="h-20 max-w-[1360px] mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop flex items-center justify-between gap-space-md">
          <Link href="/" className="flex items-center gap-space-sm md:gap-space-md shrink-0">
            <Logo />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary leading-none tracking-tight">RoastRoute</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Local Coffee Finder</span>
            </div>
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container" />
              <span className="font-label-sm text-label-sm text-on-surface-variant">Local Server • Saves Persist</span>
            </div>
          </Link>

          <form onSubmit={search} className="hidden lg:flex flex-1 max-w-sm mx-space-sm" role="search">
            <div className="relative w-full flex items-center bg-surface-container-low rounded-full px-3 py-1.5 shadow-[0_1px_4px_rgba(44,24,16,0.04)] focus-within:ring-2 focus-within:ring-secondary">
              <Icon name={busy ? 'progress_activity' : 'location_on'} className={`text-secondary text-lg mr-2 ${busy ? 'animate-spin' : ''}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                placeholder="Search neighborhood, city, or postcode..."
                aria-label="Search a place"
              />
            </div>
          </form>

          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? 'page' : undefined}
                className={`px-3.5 py-2 transition-colors flex items-center gap-1.5 rounded-full font-label-md text-label-md ${
                  active(n.href)
                    ? 'bg-primary-container text-on-primary-container shadow-[0_2px_8px_rgba(44,24,16,0.12)]'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>{n.label}</span>
                {n.href === '/favorites' && favorites.length > 0 && (
                  <span className="px-1.5 rounded-full bg-secondary-container font-label-sm text-label-sm text-on-secondary-container">
                    {favorites.length}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="relative flex items-center gap-space-sm shrink-0 pl-2" ref={menuRef}>
            {user ? (
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="relative w-9 h-9 rounded-full bg-secondary text-on-secondary font-label-lg text-label-lg flex items-center justify-center shadow-[0_1px_4px_rgba(44,24,16,0.12)]"
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                {user.username[0].toUpperCase()}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim ring-2 ring-surface" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuth('login')}
                  className="px-3.5 py-2 rounded-full text-on-surface font-label-md text-label-md hover:bg-surface-container flex items-center gap-1.5"
                >
                  <Icon name="login" className="text-base text-secondary" />
                  <span>Log in</span>
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="hidden sm:flex px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md shadow-sm hover:opacity-95 items-center gap-1.5"
                >
                  <Icon name="person_add" className="text-base" />
                  <span>Sign up</span>
                </button>
              </>
            )}
            {menuOpen && user && (
              <div className="absolute right-0 top-12 w-56 bg-surface-container-lowest rounded-xl shadow-xl p-2 space-y-1">
                <div className="px-3 py-2">
                  <p className="font-title-sm text-title-sm text-primary flex items-center gap-1.5">
                    {user.username}
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">
                        <Icon name="shield_person" className="text-xs" /> Admin
                      </span>
                    )}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{favorites.length} saved spots</p>
                </div>
                <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container font-label-md text-label-md text-on-surface">
                  <Icon name="tune" className="text-base text-secondary" /> App Settings
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-container font-label-md text-label-md text-on-surface">
                    <Icon name="admin_panel_settings" className="text-base text-secondary" /> Admin Console
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-error-container/50 font-label-md text-label-md text-on-surface"
                >
                  <Icon name="logout" className="text-base text-error" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[1500] bg-surface/95 backdrop-blur-xl shadow-[0_-1px_8px_rgba(44,24,16,0.08)] flex justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl font-label-sm text-label-sm ${
              active(n.href) ? 'text-secondary' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={n.icon} fill={active(n.href)} className="text-2xl" />
            {n.label.split(' ').pop()}
          </Link>
        ))}
      </nav>
    </>
  );
}
