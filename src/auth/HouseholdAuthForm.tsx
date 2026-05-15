import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  parseInviteTokenFromHash,
  parseResetTokenFromHash,
  postNotifyRelayPublicJson,
  setNotifyRelayHouseholdId,
} from '../utils/notifyRelayConfig';
import { writeHouseholdSession } from '../utils/householdSession';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import { clearLocalFinanceCache } from '../utils/clearLocalFinanceCache';
import { generateHouseholdId } from '../utils/generateHouseholdId';
import type { ThemePreference } from '../types/finance';
import { FieldError } from '../components/ui/FieldError';
import { fieldErrorId } from '../components/ui/fieldErrorId';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import { THEME_SEGMENT_OPTIONS } from '../components/ui/themeSegmentedOptions';

type Tab = 'signin' | 'register';
type AuthPanel = 'default' | 'forgot' | 'reset';

function finishAuth(
  member: { email?: string; role?: string; householdId?: string },
  token: string,
  onAuthed?: () => void | Promise<void>,
) {
  clearLocalFinanceCache();
  if (member.householdId) setNotifyRelayHouseholdId(member.householdId);
  writeHouseholdSession({
    token,
    householdId: member.householdId!,
    email: member.email,
    role: member.role,
  });
  void Promise.resolve(onAuthed?.());
}

export function HouseholdAuthForm({
  theme,
  onTheme,
  onAuthed,
  variant = 'embedded',
  initialTab = 'signin',
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  onAuthed?: () => void | Promise<void>;
  variant?: 'embedded' | 'standalone';
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdIdField, setHouseholdIdField] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [resetTokenFromHash, setResetTokenFromHash] = useState<string | null>(null);
  const [newPasswordAfterReset, setNewPasswordAfterReset] = useState('');
  const [authPanel, setAuthPanel] = useState<AuthPanel>('default');
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

  const syncHashTokens = useCallback(() => {
    const t = parseInviteTokenFromHash();
    if (t) setInviteToken(t);
    const rt = parseResetTokenFromHash();
    if (rt) {
      setResetTokenFromHash(rt);
      setAuthPanel('reset');
      setTab('signin');
    }
  }, []);

  useEffect(() => {
    syncHashTokens();
    window.addEventListener('hashchange', syncHashTokens);
    return () => window.removeEventListener('hashchange', syncHashTokens);
  }, [syncHashTokens]);

  const loginHouseholdId = () => householdIdField.trim().slice(0, 64);

  const register = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const newHid = generateHouseholdId();
      setNotifyRelayHouseholdId(newHid);
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/register', {
        householdId: newHid,
        email,
        password,
      })) as {
        needsEmailVerification?: boolean;
        token?: string;
        member?: { email?: string; role?: string; householdId?: string };
      };
      if (j.needsEmailVerification) {
        setMsg('Check your inbox for a verification link. After you verify, sign in with the same email and password.');
        setTab('signin');
      } else if (j.token && j.member?.householdId) {
        finishAuth(j.member, j.token as string, onAuthed);
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
      const hid = loginHouseholdId();
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/login', {
        ...(hid ? { householdId: hid } : {}),
        email,
        password,
      })) as { token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.token && j.member?.householdId) {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
        finishAuth(j.member, j.token, onAuthed);
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
      const hid = loginHouseholdId();
      await postNotifyRelayPublicJson('/v1/household/auth/request-magic-login', {
        ...(hid ? { householdId: hid } : {}),
        email,
      });
      setMsg('If that email is registered, a sign-in link was sent (check spam).');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestForgot = async () => {
    if (!email.trim()) {
      setMsg('Enter your account email first.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const hid = loginHouseholdId();
      await postNotifyRelayPublicJson('/v1/household/auth/request-password-reset', {
        ...(hid ? { householdId: hid } : {}),
        email: email.trim(),
      });
      setMsg('If an owner account exists for that email, a reset link was sent (check spam).');
      setAuthPanel('default');
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
      await postNotifyRelayPublicJson('/v1/household/auth/reset-password', {
        token: resetTokenFromHash,
        newPassword: newPasswordAfterReset,
      });
      setMsg('Password updated — you can sign in.');
      setResetTokenFromHash(null);
      setAuthPanel('default');
      setNewPasswordAfterReset('');
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
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/accept-invite', {
        token: inviteToken.trim(),
        email: partnerEmail.trim(),
      })) as { token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.token && j.member?.householdId) {
        finishAuth(j.member, j.token, onAuthed);
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const emailErr = email.trim() && !email.includes('@') ? 'Enter a valid email.' : null;
  const pwdErr = tab === 'register' && password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters.' : null;
  const compact = variant === 'embedded';

  return (
    <div className={compact ? 'flex flex-col' : 'mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-10 sm:px-6'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">
            {compact ? 'Get started' : 'Account'}
          </p>
          <h2
            className={
              compact
                ? 'mt-1 font-display text-xl font-bold text-slate-950 dark:text-moss-fg'
                : 'mt-1 font-display text-2xl font-bold text-slate-950 dark:text-moss-fg'
            }
          >
            {compact ? 'Sign in or register' : 'Household sign-in'}
          </h2>
          {!compact ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-moss-muted">
              Sign in with your email — household id is optional if you only have one account.
            </p>
          ) : null}
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

      <div className={compact ? 'mt-4' : 'mt-6 max-w-md'}>
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

      <div
        className={
          compact
            ? 'mt-4 space-y-4 rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-4 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25'
            : 'mt-6 space-y-4 rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25'
        }
      >
        <fieldset>
          <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-moss-muted">
            Household mode
          </legend>
          <div className="mt-2 max-w-md">
            <SegmentedChoice
              name="household-mode-auth-form"
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
        {authPanel !== 'forgot' ? (
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
        ) : null}

        {tab === 'signin' && authPanel === 'default' ? (
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
            Household id <span className="font-normal normal-case text-slate-500">(optional)</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
              value={householdIdField}
              onChange={(e) => setHouseholdIdField(e.target.value)}
              placeholder="Leave blank if unsure"
              autoComplete="off"
            />
          </label>
        ) : null}

        {authPanel === 'forgot' ? (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-moss-border dark:bg-moss-bg/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-moss-fg">Reset your password</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-moss-muted">
              We will email a link to this address. The link opens this page with a form to choose a new password.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary btn-primary-sm font-bold"
                disabled={busy || !email.trim()}
                onClick={() => void requestForgot()}
              >
                Send reset link
              </button>
              <button
                type="button"
                className="btn-ghost text-xs font-semibold"
                disabled={busy}
                onClick={() => {
                  setAuthPanel('default');
                  setMsg(null);
                }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        ) : null}

        {resetTokenFromHash && authPanel === 'reset' ? (
          <form
            className="rounded-xl border-2 border-amber-400/80 bg-amber-50/90 p-3 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/40"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void resetPassword();
            }}
          >
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Set a new password</p>
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/85">
              You opened a reset link from your email. Choose a new password, then sign in.
            </p>
            <input
              type="password"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg"
              placeholder="New password (min 8)"
              value={newPasswordAfterReset}
              onChange={(e) => setNewPasswordAfterReset(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="submit"
              className="btn-primary btn-primary-sm mt-2 font-bold"
              disabled={busy || newPasswordAfterReset.length < 8}
            >
              Update password
            </button>
          </form>
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

        {authPanel === 'default' ? (
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
            {tab === 'signin' ? (
              <>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm font-bold"
                  disabled={busy || !email.trim()}
                  onClick={() => void requestMagic()}
                >
                  Email me a link
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm font-bold"
                  disabled={busy}
                  onClick={() => {
                    setAuthPanel('forgot');
                    setMsg(null);
                  }}
                >
                  Forgot password
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {msg ? <p className="text-sm font-medium text-slate-800 dark:text-moss-fg">{msg}</p> : null}
        {compact ? (
          <p className="text-xs text-slate-500 dark:text-moss-muted">
            New accounts start with a blank worksheet. Your data stays private to your household.
          </p>
        ) : (
          <p className="text-xs text-slate-500 dark:text-moss-muted">
            Advanced account tools (invites, pairing, API keys) remain under{' '}
            <strong className="text-slate-700 dark:text-moss-subtle">Tools</strong> after you enter the dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
