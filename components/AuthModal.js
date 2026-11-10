'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

export default function AuthModal({ initialMode = 'login', onClose, onAuthed }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Live hints while creating an account.
  const userOk = USERNAME_RE.test(username);
  const pwOk = password.length >= 6;
  const matchOk = password === confirm;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (register) {
      if (!userOk) return setError('Username must be 3–32 characters: letters, numbers, _ . -');
      if (!pwOk) return setError('Password must be at least 6 characters.');
      if (!matchOk) return setError('The two passwords don’t match.');
    }
    setBusy(true);
    try {
      onAuthed(await post(`/api/auth/${register ? 'register' : 'login'}`, { username, password }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setConfirm('');
  }

  const input =
    'w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-secondary';
  const label = 'font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={register ? 'Create an account' : 'Log in'}
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-lg md:p-space-xl shadow-2xl space-y-space-md my-auto"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
              <Icon name={register ? 'person_add' : 'person'} className="text-xs" />
              <span>{register ? 'New RoastRoute account' : 'Your RoastRoute account'}</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary">{register ? 'Create your account' : 'Welcome back'}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {register
                ? 'Free and local — your account lives on this server, not in the cloud.'
                : 'Log in to see your favourites, notes and settings.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-full bg-surface-container-low p-1" role="tablist">
          {[
            ['login', 'Log in'],
            ['register', 'Create account'],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => switchMode(k)}
              className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
                mode === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className={label}>Username</span>
          <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          {register && username && (
            <Hint ok={userOk}>3–32 characters: letters, numbers, _ . -</Hint>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className={label}>Password</span>
          <div className="relative">
            <input
              className={`${input} pr-11`}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={register ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPw ? 'visibility_off' : 'visibility'} className="text-lg" />
            </button>
          </div>
          {register && password && <Hint ok={pwOk}>At least 6 characters</Hint>}
        </label>

        {register && (
          <label className="block space-y-1.5">
            <span className={label}>Confirm Password</span>
            <input
              className={input}
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirm && <Hint ok={matchOk}>{matchOk ? 'Passwords match' : 'Passwords don’t match yet'}</Hint>}
          </label>
        )}

        {error && (
          <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2">
            <Icon name="error" className="text-base" /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={`w-full px-5 py-3 rounded-full font-label-lg text-label-lg shadow-sm hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2 ${
            register ? 'bg-secondary text-on-secondary' : 'bg-primary-container text-on-primary'
          }`}
        >
          <Icon name={register ? 'person_add' : 'login'} className="text-lg" />
          {busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

function Hint({ ok, children }) {
  return (
    <span className={`flex items-center gap-1 font-label-sm text-label-sm ${ok ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
      <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} fill={ok} className="text-sm" />
      {children}
    </span>
  );
}
