'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, useApp } from '@/components/Providers';
import Icon from '@/components/Icon';
import { EmptyState } from '@/components/ShopBits';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
function fmtAgo(iso) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}
const fmtUptime = (s) => (s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);

export default function AdminPage() {
  const { user, authReady, openAuth, confirm, toast } = useApp();
  const isAdmin = user?.role === 'admin';
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [resetFor, setResetFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, u] = await Promise.all([api('/api/admin/overview'), api('/api/admin/users')]);
      setOverview(o);
      setUsers(u.users);
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const t = setInterval(() => api('/api/admin/overview').then(setOverview).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  async function act(target, action, extra = {}) {
    const prompts = {
      demote: { title: `Remove admin rights from ${target.username}?`, body: 'They will become a regular user and lose access to this console.', confirmLabel: 'Remove admin' },
      promote: { title: `Make ${target.username} an administrator?`, body: 'Admins can manage every account on this server, including deleting users and resetting passwords.', confirmLabel: 'Make admin' },
      disable: { title: `Disable ${target.username}?`, body: 'They will be signed out everywhere and won’t be able to log in until re-enabled. Their data is kept.', confirmLabel: 'Disable account', danger: true },
      signout: { title: `Sign ${target.username} out everywhere?`, body: 'All of their active sessions will end. They can log straight back in.', confirmLabel: 'Sign out' },
    };
    if (prompts[action] && !(await confirm(prompts[action]))) return;
    setBusy(`${target.key}:${action}`);
    try {
      await api('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ username: target.username, action, ...extra }) });
      toast(
        {
          promote: `${target.username} is now an admin`,
          demote: `${target.username} is now a regular user`,
          disable: `${target.username} has been disabled`,
          enable: `${target.username} has been re-enabled`,
          signout: `${target.username} was signed out everywhere`,
          'reset-password': `Password reset for ${target.username}`,
        }[action],
      );
      await load();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function remove(target) {
    const ok = await confirm({
      title: `Delete ${target.username}?`,
      body: `This permanently deletes the account and its ${target.favorites} favourite${target.favorites === 1 ? '' : 's'}, notes and cupping logs. This cannot be undone — download a backup first if you might need it.`,
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    setBusy(`${target.key}:delete`);
    try {
      await api(`/api/admin/users?username=${encodeURIComponent(target.username)}`, { method: 'DELETE' });
      toast(`${target.username} was deleted`);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function maintenance(action) {
    setBusy(action);
    try {
      const d = await api('/api/admin/maintenance', { method: 'POST', body: JSON.stringify({ action }) });
      toast(d.message);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  const visible = useMemo(() => users.filter((u) => u.username.toLowerCase().includes(q.trim().toLowerCase())), [users, q]);

  if (!authReady) return <Wrap><div className="h-96 rounded-xl bg-surface-container-lowest animate-pulse" /></Wrap>;
  if (!user) {
    return (
      <Wrap>
        <EmptyState icon="admin_panel_settings" title="Administrator login required" body="Log in with an administrator account to open the admin console.">
          <button onClick={() => openAuth('login')} className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5">
            <Icon name="login" className="text-base" /> Log in
          </button>
        </EmptyState>
      </Wrap>
    );
  }
  if (!isAdmin) {
    return (
      <Wrap>
        <EmptyState icon="block" title="Admins only" body="Your account doesn't have administrator privileges. Ask an administrator of this server if you need access.">
          <Link href="/" className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md">
            Back to Explore Map
          </Link>
        </EmptyState>
      </Wrap>
    );
  }

  const st = overview?.stats;
  const sv = overview?.server;

  return (
    <Wrap className="space-y-space-xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm uppercase tracking-wider">
              <Icon name="shield_person" className="text-sm" /> Administrator only
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Signed in as {user.username}</span>
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary tracking-tight">Admin Console</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
            Manage accounts, roles and server maintenance for this RoastRoute installation. Regular users can&apos;t see this page or call these APIs.
          </p>
        </div>
        <a
          href="/api/admin/maintenance"
          className="self-start lg:self-auto px-4 py-2.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md flex items-center gap-1.5 shadow-sm"
        >
          <Icon name="download" className="text-base" /> Download full database backup
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
        <Metric icon="group" label="Accounts" value={st?.users} sub={st ? `${st.admins} admin${st.admins === 1 ? '' : 's'} • ${st.disabled} disabled` : ''} />
        <Metric icon="login" label="Active this week" value={st?.activeThisWeek} sub={st ? `${st.activeSessions} live sessions` : ''} />
        <Metric icon="favorite" label="Saved favourites" value={st?.favorites} sub={st ? `${st.customSpots} secret spots` : ''} accent />
        <Metric icon="coffee" label="Notes & cupping logs" value={st ? st.notes + st.cupping : undefined} sub={st ? `${st.notes} notes • ${st.cupping} cuppings` : ''} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Users */}
        <section className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                <Icon name="manage_accounts" className="text-xl" />
              </span>
              <div>
                <h2 className="font-title-md text-title-md text-primary">User Management</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Roles, access and passwords</p>
              </div>
            </div>
            <div className="relative sm:w-64">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a user…"
                className="w-full pl-9 pr-3 py-2 rounded-full bg-surface-container-low font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
          <ul className="divide-y divide-surface-container-high">
            {visible.map((u) => {
              const me = u.key === user.username.toLowerCase();
              const b = (a) => busy === `${u.key}:${a}`;
              return (
                <li key={u.key} className={`p-space-md md:px-space-lg flex flex-col md:flex-row md:items-center gap-3 ${u.disabled ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-label-lg text-label-lg shrink-0 ${u.role === 'admin' ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-primary'}`}>
                      {u.username[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-title-sm text-title-sm text-primary truncate">{u.username}</span>
                        {u.role === 'admin' && <Badge className="bg-primary-container text-on-primary" icon="shield_person">Admin</Badge>}
                        {me && <Badge className="bg-secondary-container text-on-secondary-container">You</Badge>}
                        {u.disabled && <Badge className="bg-error-container text-on-error-container" icon="block">Disabled</Badge>}
                      </div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                        Joined {fmtDate(u.createdAt)} • Last login {fmtAgo(u.lastLoginAt)} • {u.favorites} saved • {u.cupping} cuppings • {u.activeSessions} session{u.activeSessions === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:justify-end">
                    {u.role === 'admin' ? (
                      <ActionBtn icon="remove_moderator" disabled={me || b('demote')} title={me ? "You can't demote yourself" : 'Remove admin rights'} onClick={() => act(u, 'demote')}>
                        Demote
                      </ActionBtn>
                    ) : (
                      <ActionBtn icon="add_moderator" disabled={u.disabled || b('promote')} onClick={() => act(u, 'promote')}>
                        Make admin
                      </ActionBtn>
                    )}
                    <ActionBtn icon="password" disabled={b('reset-password')} onClick={() => setResetFor(u)}>
                      Reset password
                    </ActionBtn>
                    <ActionBtn icon="logout" disabled={!u.activeSessions || b('signout')} onClick={() => act(u, 'signout')}>
                      Sign out
                    </ActionBtn>
                    {u.disabled ? (
                      <ActionBtn icon="check_circle" disabled={b('enable')} onClick={() => act(u, 'enable')}>
                        Enable
                      </ActionBtn>
                    ) : (
                      <ActionBtn icon="block" danger disabled={me || b('disable')} title={me ? "You can't disable yourself" : undefined} onClick={() => act(u, 'disable')}>
                        Disable
                      </ActionBtn>
                    )}
                    <ActionBtn icon="delete" danger disabled={me || b('delete')} title={me ? "You can't delete yourself" : undefined} onClick={() => remove(u)}>
                      Delete
                    </ActionBtn>
                  </div>
                </li>
              );
            })}
            {!visible.length && <li className="p-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">No users match “{q}”.</li>}
          </ul>
        </section>

        {/* Server */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
            <div className="flex items-center gap-3 mb-space-md">
              <span className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                <Icon name="dns" className="text-xl" />
              </span>
              <div>
                <h2 className="font-title-md text-title-md text-primary">Server &amp; Maintenance</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Refreshes every 10 seconds</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 mb-space-md">
              <Stat label="Node.js" value={sv?.node} />
              <Stat label="Mode" value={sv?.mode} />
              <Stat label="Uptime" value={sv ? fmtUptime(sv.uptimeSec) : undefined} />
              <Stat label="Memory" value={sv ? `${sv.memoryMb} MB` : undefined} />
              <Stat label="Database" value={sv ? `${(sv.dbBytes / 1024).toFixed(1)} KB` : undefined} />
              <Stat label="Cached searches" value={sv?.cachedSearches} />
            </dl>
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-space-md font-mono">{sv?.dbFile} • {sv?.platform}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => maintenance('clear-cache')}
                disabled={busy === 'clear-cache'}
                className="w-full px-4 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="cached" className="text-base text-secondary" /> Clear café search cache
              </button>
              <button
                onClick={() => maintenance('prune-sessions')}
                disabled={busy === 'prune-sessions'}
                className="w-full px-4 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="cleaning_services" className="text-base text-secondary" /> Prune expired sessions
              </button>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
            <div className="flex items-center gap-2 mb-space-md">
              <Icon name="trending_up" className="text-secondary" />
              <h2 className="font-title-md text-title-md text-primary">Most-saved cafés</h2>
            </div>
            {overview?.topCafes?.length ? (
              <ol className="space-y-2">
                {overview.topCafes.map((c, i) => (
                  <li key={c.id}>
                    <Link href={`/shop/${c.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low">
                      <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center font-label-sm text-label-sm text-primary">{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-title-sm text-title-sm text-primary truncate">{c.name}</span>
                        {c.neighborhood && <span className="block font-label-sm text-label-sm text-on-surface-variant">{c.neighborhood}</span>}
                      </span>
                      <span className="font-label-md text-label-md text-secondary">{c.saves}♥</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No cafés saved yet.</p>
            )}
          </section>
        </div>
      </div>

      {resetFor && (
        <ResetPasswordModal
          target={resetFor}
          onClose={() => setResetFor(null)}
          onSubmit={async (pw) => {
            const ok = await act(resetFor, 'reset-password', { password: pw });
            if (ok) setResetFor(null);
          }}
        />
      )}
    </Wrap>
  );
}

function Wrap({ children, className = '' }) {
  return <div className={`max-w-[1360px] w-full mx-auto px-margin md:px-margin-tablet lg:px-margin-desktop py-space-xl ${className}`}>{children}</div>;
}

function Metric({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
        <Icon name={icon} className="text-secondary" />
      </div>
      <p className={`font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg mt-1 ${accent ? 'text-secondary' : 'text-primary'}`}>
        {value ?? '—'}
      </p>
      <p className="font-label-sm text-label-sm text-on-surface-variant">{sub}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-2.5">
      <dt className="font-label-sm text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="font-title-sm text-title-sm text-primary truncate">{value ?? '—'}</dd>
    </div>
  );
}

function Badge({ children, icon, className }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm ${className}`}>
      {icon && <Icon name={icon} className="text-xs" />}
      {children}
    </span>
  );
}

function ActionBtn({ icon, children, onClick, disabled, danger, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2.5 py-1.5 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'bg-error-container/60 text-on-error-container hover:bg-error-container' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
      }`}
    >
      <Icon name={icon} className="text-sm" />
      {children}
    </button>
  );
}

function ResetPasswordModal({ target, onClose, onSubmit }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = pw.length >= 6;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setBusy(true);
          await onSubmit(pw);
          setBusy(false);
        }}
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-lg shadow-2xl space-y-space-md"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-primary">Reset password</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Set a new password for <strong>{target.username}</strong>. They&apos;ll be signed out everywhere and must use the new password.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">New password</span>
          <input
            type="text"
            autoFocus
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <span className="font-label-sm text-label-sm text-on-surface-variant">At least 6 characters. Share it with them privately.</span>
        </label>
        <div className="flex justify-end gap-space-sm">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <button type="submit" disabled={!ok || busy} className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-label-md text-label-md disabled:opacity-50">
            {busy ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </form>
    </div>
  );
}
