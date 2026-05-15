import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiBaseFromNotifyUrl,
  ensureNotifyRelayHouseholdId,
  parseInviteTokenFromHash,
  parseResetTokenFromHash,
  readNotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import { readHouseholdSession, writeHouseholdSession } from '../utils/householdSession';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import type { ThemePreference } from '../types/finance';
import { FieldError } from '../components/ui/FieldError';
import { fieldErrorId } from '../components/ui/fieldErrorId';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import { THEME_SEGMENT_OPTIONS } from '../components/ui/themeSegmentedOptions';
import { zLayers } from '../ui/zLayers';

type Tab = 'signin' | 'register';

export function HouseholdAuthShell({
  theme,
  onTheme,
  onAuthed,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  onAuthed: () => void;
}) {
  const hid = useMemo(() => (typeof window !== 'undefined' ? ensureNotifyRelayHouseholdId() : ''), []);
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [resetTokenFromHash, setResetTokenFromHash] = useState<string | null>(null);
  const [newPasswordAfterReset, setNewPasswordAfterReset] = useState('');
  const [mode, setMode] = useState<HouseholdMode>(() => {
    try {
      const v = localStorage.getItem(HOUSEHOLD_MODE_KEY);
      return v === 'single' ? 'single' : 'couple';
    } catch {
      return 'couple';
    }
  });

  const persistMode = (m: HouseholdMode) => {
    setMode(m);
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const t = parseInviteTokenFromHash();
    if (t) setInviteToken(t);
    const rt = parseResetTokenFromHash();
    if (rt) setResetTokenFromHash(rt);
  }, []);

  const postJson = useCallback(async (path: string, body: Record<string, unknown>, withInviteAuth?: boolean) => {
    const { url, secret } = readNotifyRelayConfig();
    const base = apiBaseFromNotifyUrl(url);
    if (!base) throw new Error('Set notify API URL first (Tools → relay URL).');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (withInviteAuth) {
      const sess = readHouseholdSession();
      if (sess?.token) headers.Authorization = `Bearer ${sess.token}`;
      else if (secret.trim()) headers.Authorization = `Bearer ${secret.trim()}`;
    }
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let j: Record<string, unknown> = {};
    try {
      j = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!res.ok) throw new Error((j.error as string) || text || `HTTP ${res.status}`);
    return j;
  }, []);

  const register = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const j = (await postJson('/v1/household/auth/register', {
        householdId: hid,
        email,
        password,
      })) as { needsEmailVerification?: boolean; token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.needsEmailVerification) {
        setMsg('Check your inbox for a verification link. After you verify, sign in here with the same email and password.');
        setTab('signin');
      } else if (j.token && j.member?.householdId) {
        writeHouseholdSession({
          token: j.token as string,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
        });
        onAuthed();
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const j = (await postJson('/v1/household/auth/login', {
        householdId: hid,
        email,
        password,
      })) as { token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.token && j.member?.householdId) {
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
        });
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
        onAuthed();
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestMagic = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/request-magic-login', { householdId: hid, email });
      setMsg('If that email is on this household, a sign-in link was sent (check spam).');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestForgot = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/request-password-reset', { householdId: hid, email });
      setMsg('If the account exists, a reset link was sent.');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTokenFromHash) return;
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/reset-password', {
        token: resetTokenFromHash,
        newPassword: newPasswordAfterReset,
      });
      setMsg('Password updated — you can sign in.');
      setResetTokenFromHash(null);
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const j = (await postJson('/v1/household/auth/accept-invite', {
        token: inviteToken.trim(),
        email: partnerEmail.trim(),
      })) as { token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.token && j.member?.householdId) {
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
        });
        onAuthed();
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const emailErr = email.trim() && !email.includes('@') ? 'Enter a valid email.' : null;
  const pwdErr = tab === 'register' && password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters.' : null;

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: zLayers.setupWizard }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-shell-title"
    >
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">Account</p>
            <h1 id="auth-shell-title" className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-moss-fg">
              Household sign-in
            </h1>
            <p className="mt-2 text-xs text-slate-600 dark:text-moss-muted">
              Household id: <code className="font-mono font-semibold">{hid || '…'}</code>
            </p>
          </div>
          <div className="w-full max-w-[11.5rem] shrink-0 sm:max-w-[13rem]">
            <SegmentedButtonGroup
              aria-label="Color theme"
              value={theme}
              onChange={onTheme}
              options={THEME_SEGMENT_OPTIONS}
              size="compact"
            />
          </div>
        </div>

        <div className="mt-6 max-w-md">
          <SegmentedButtonGroup
            aria-label="Sign in or register"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'signin', label: 'Sign in' },
              { id: 'register', label: 'Register' },
            ]}
          />
        </div>

        <div className="mt-6 space-y-4 rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-moss-muted">
              Household mode
            </legend>
            <div className="mt-2 max-w-md">
              <SegmentedChoice
                name="household-mode-auth-shell"
                aria-label="Household mode"
                value={mode}
                onChange={persistMode}
                options={[
                  { id: 'single', label: 'Single' },
                  { id: 'couple', label: 'Couple / shared' },
                ]}
              />
            </div>
          </fieldset>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(emailErr)}
              aria-describedby={emailErr ? fieldErrorId('auth-email') : undefined}
            />
            <FieldError id={fieldErrorId('auth-email')} message={emailErr} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
            Password {tab === 'register' ? '(min 8)' : ''}
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
            <FieldError id={fieldErrorId('auth-password')} message={pwdErr} />
          </label>

          {resetTokenFromHash ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Set a new password</p>
              <input
                type="password"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg"
                placeholder="New password (min 8)"
                value={newPasswordAfterReset}
                onChange={(e) => setNewPasswordAfterReset(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary btn-primary-sm mt-2 font-bold"
                disabled={busy || newPasswordAfterReset.length < 8}
                onClick={() => void resetPassword()}
              >
                Update password
              </button>
            </div>
          ) : null}

          {inviteToken ? (
            <div className="space-y-2 rounded-xl border border-teal-200/80 bg-teal-50/50 p-3 dark:border-teal-900/40 dark:bg-teal-950/25">
              <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">Accept partner invite</p>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg"
                placeholder="Your email on the invite"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
              />
              <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void acceptInvite()}>
                Join household
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {tab === 'register' ? (
              <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void register()}>
                Create account
              </button>
            ) : (
              <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void login()}>
                Sign in
              </button>
            )}
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy || !email.trim()} onClick={() => void requestMagic()}>
              Email me a link
            </button>
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy || !email.trim()} onClick={() => void requestForgot()}>
              Forgot password
            </button>
          </div>

          {msg ? <p className="text-sm font-medium text-slate-800 dark:text-moss-fg">{msg}</p> : null}
          <p className="text-xs text-slate-500 dark:text-moss-muted">
            Advanced account tools (invites, pairing, API keys) remain under{' '}
            <strong className="text-slate-700 dark:text-moss-subtle">Workspace → Tools</strong> after you enter the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
