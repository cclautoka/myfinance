import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiBaseFromNotifyUrl,
  ensureNotifyRelayHouseholdId,
  parseInviteTokenFromHash,
  parseResetTokenFromHash,
  readNotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import { clearHouseholdSession, readHouseholdSession, writeHouseholdSession } from '../utils/householdSession';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';
import { SegmentedChoice } from './ui/SegmentedChoice';

function isValidEmail(v: string) {
  const t = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type AuthFieldErrors = Partial<{
  email: string;
  password: string;
  partnerEmail: string;
  inviteToken: string;
  pairDigits: string;
  pairPassword: string;
  newPassword: string;
}>;

export function HouseholdAuthPanel({ onAuthChange }: { onAuthChange?: () => void }) {
  const hid = useMemo(() => (typeof window !== 'undefined' ? ensureNotifyRelayHouseholdId() : ''), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetTokenFromHash, setResetTokenFromHash] = useState<string | null>(null);
  const [newPasswordAfterReset, setNewPasswordAfterReset] = useState('');
  const [pairDigits, setPairDigits] = useState('');
  const [pairPassword, setPairPassword] = useState('');
  const [bearerKeysText, setBearerKeysText] = useState<string | null>(null);
  const [inlineErr, setInlineErr] = useState<AuthFieldErrors>({});
  const [mode, setMode] = useState<HouseholdMode>(() => {
    try {
      const v = localStorage.getItem(HOUSEHOLD_MODE_KEY);
      return v === 'single' ? 'single' : 'couple';
    } catch {
      return 'couple';
    }
  });

  const session = typeof window !== 'undefined' ? readHouseholdSession() : null;

  useEffect(() => {
    const t = parseInviteTokenFromHash();
    if (t) setInviteToken(t);
    const rt = parseResetTokenFromHash();
    if (rt) setResetTokenFromHash(rt);
  }, []);

  const persistMode = (m: HouseholdMode) => {
    setMode(m);
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const baseUrl = useMemo(() => {
    const { url } = readNotifyRelayConfig();
    return apiBaseFromNotifyUrl(url);
  }, []);

  const postJson = useCallback(async (path: string, body: Record<string, unknown>, withInviteAuth?: boolean) => {
    const { url, secret } = readNotifyRelayConfig();
    const base = apiBaseFromNotifyUrl(url);
    if (!base) throw new Error('Set notify API URL first');
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
    const next: AuthFieldErrors = {};
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (Object.keys(next).length) {
      setInlineErr(next);
      return;
    }
    setInlineErr({});
    setBusy(true);
    setMsg(null);
    try {
      const j = (await postJson('/v1/household/auth/register', {
        householdId: hid,
        email,
        password,
      })) as {
        token?: string;
        needsEmailVerification?: boolean;
        member?: { email?: string; role?: string; householdId?: string };
      };
      if (j.needsEmailVerification) {
        setMsg('Check your email to verify, then sign in here with the same password.');
      } else if (j.token && j.member?.householdId) {
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
        });
        setMsg('Registered and signed in on this device.');
        onAuthChange?.();
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    const next: AuthFieldErrors = {};
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    if (Object.keys(next).length) {
      setInlineErr(next);
      return;
    }
    setInlineErr({});
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
      }
      setMsg('Signed in.');
      onAuthChange?.();
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { householdId: hid };
      const { secret } = readNotifyRelayConfig();
      const sess = readHouseholdSession();
      if (!sess?.token && secret.trim()) {
        body.ownerEmail = email.trim() || readNotifyRelayConfig().husbandEmail;
      }
      const j = (await postJson('/v1/household/auth/invite', body, true)) as {
        inviteUrl?: string | null;
        token?: string;
        inviteHashFragment?: string;
      };
      const link =
        j.inviteUrl ||
        (j.inviteHashFragment
          ? `${window.location.origin}${window.location.pathname}#${j.inviteHashFragment}`
          : j.token
            ? `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(j.token)}`
            : '');
      setMsg(link ? `Invite link (copy): ${link}` : 'Invite created.');
      if (link) void navigator.clipboard?.writeText(link);
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    const next: AuthFieldErrors = {};
    if (!inviteToken.trim()) next.inviteToken = 'Paste the invite token from your link.';
    if (!partnerEmail.trim()) next.partnerEmail = 'Enter your email.';
    else if (!isValidEmail(partnerEmail)) next.partnerEmail = 'Enter a valid email address.';
    if (Object.keys(next).length) {
      setInlineErr(next);
      return;
    }
    setInlineErr({});
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
      }
      setMsg('Joined household. Session saved on this device.');
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
      onAuthChange?.();
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestVerifyEmail = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/request-verify-email', {}, true);
      setMsg('Verification email sent (if mail is configured).');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestForgotPassword = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/request-password-reset', { householdId: hid, email: email.trim() });
      setMsg('If that primary email exists, a reset link was sent.');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const requestMagicLogin = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/request-magic-login', { householdId: hid, email: email.trim() });
      setMsg('If that email is registered for this household, a sign-in link was sent (15 min).');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const submitPasswordReset = async () => {
    if (!resetTokenFromHash) return;
    if (newPasswordAfterReset.length < 8) {
      setInlineErr({ newPassword: 'Password must be at least 8 characters.' });
      return;
    }
    setInlineErr({});
    setBusy(true);
    setMsg(null);
    try {
      await postJson('/v1/household/auth/reset-password', {
        token: resetTokenFromHash,
        newPassword: newPasswordAfterReset,
      });
      setMsg('Password updated. You can sign in with the new password.');
      setResetTokenFromHash(null);
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

  const createPairing = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { householdId: hid };
      const { secret } = readNotifyRelayConfig();
      const sess = readHouseholdSession();
      if (!sess?.token && secret.trim()) {
        body.ownerEmail = email.trim() || readNotifyRelayConfig().husbandEmail;
      }
      const j = (await postJson('/v1/household/pairing/create', body, true)) as { code?: string };
      if (j.code) {
        setMsg(`Pairing code (15 min): ${j.code} — share with your partner on this household only.`);
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const redeemPairing = async () => {
    const digits = pairDigits.replace(/\D/g, '');
    const next: AuthFieldErrors = {};
    if (digits.length !== 6) next.pairDigits = 'Enter the 6-digit code.';
    if (!partnerEmail.trim()) next.partnerEmail = 'Enter your email.';
    else if (!isValidEmail(partnerEmail)) next.partnerEmail = 'Enter a valid email address.';
    if (pairPassword.length < 8) next.pairPassword = 'Password must be at least 8 characters.';
    if (Object.keys(next).length) {
      setInlineErr(next);
      return;
    }
    setInlineErr({});
    setBusy(true);
    setMsg(null);
    try {
      const j = (await postJson('/v1/household/pairing/redeem', {
        householdId: hid,
        code: pairDigits.replace(/\D/g, ''),
        email: partnerEmail.trim(),
        password: pairPassword,
      })) as { token?: string; member?: { email?: string; role?: string; householdId?: string } };
      if (j.token && j.member?.householdId) {
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
        });
      }
      setMsg('Joined via pairing code. Session saved on this device.');
      setPairDigits('');
      setPairPassword('');
      onAuthChange?.();
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const refreshBearerKeys = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { householdId: hid, action: 'list' };
      const { secret } = readNotifyRelayConfig();
      const sess = readHouseholdSession();
      if (!sess?.token && secret.trim()) {
        body.ownerEmail = email.trim() || readNotifyRelayConfig().husbandEmail;
      }
      const j = (await postJson('/v1/household/bearer-keys', body, true)) as {
        keys?: { id: string; label: string; createdAt: string; revoked: boolean }[];
      };
      const lines = (j.keys ?? []).map((k) => `${k.revoked ? 'revoked' : 'active'}\t${k.label || '(no label)'}\t${k.id}`);
      setBearerKeysText(lines.length ? lines.join('\n') : 'No keys yet.');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const mintBearerKey = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { householdId: hid, action: 'create', label: 'device' };
      const { secret } = readNotifyRelayConfig();
      const sess = readHouseholdSession();
      if (!sess?.token && secret.trim()) {
        body.ownerEmail = email.trim() || readNotifyRelayConfig().husbandEmail;
      }
      const j = (await postJson('/v1/household/bearer-keys', body, true)) as { key?: string };
      if (j.key) {
        void navigator.clipboard?.writeText(j.key);
        setMsg(`New household API key copied once — store it safely (hk_…). Server cannot show it again.`);
      }
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearHouseholdSession();
    setMsg('Signed out (session cleared). Use shared secret or sign in again.');
    onAuthChange?.();
  };

  return (
    <div className="max-w-3xl rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 text-slate-900 shadow-md shadow-slate-900/10 dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:text-moss-fg dark:shadow-black/30">
      <h4 className="font-display text-base font-bold text-sage-900 dark:text-moss-fg">Household sign-in (server)</h4>
      <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Primary owner: email + password, or use <strong className="font-semibold">Email sign-in link</strong> for a one-time
        magic link (any member on this household id). Partners join with an invite link, pairing code, or magic link. Server
        needs <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">DATABASE_URL</code> and{' '}
        <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">SESSION_SECRET</code>. With{' '}
        <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">NOTIFY_LEGACY_SECRET_DISABLED=1</code>, the API accepts only signed-in sessions (
        <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">fm_sess_…</code>) and household keys (
        <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">hk_…</code>) — no{' '}
        <code className="rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs dark:border-moss-border dark:bg-moss-bg">NOTIFY_API_SECRET</code>.
      </p>

      <fieldset className="mt-5">
        <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-sage-600 dark:text-moss-muted">
          Household mode
        </legend>
        <div className="mt-2 max-w-md">
          <SegmentedChoice
            name="household-mode-notify"
            aria-label="Household mode"
            value={mode}
            onChange={persistMode}
            options={[
              { id: 'single', label: 'Single' },
              { id: 'couple', label: 'Couple / shared' },
            ]}
          />
        </div>
        <p className="mt-2 text-xs leading-snug text-sage-600 dark:text-moss-muted">
          Single: one primary email. Couple: two addresses for summaries and partner flows.
        </p>
      </fieldset>

      <p className="mt-2 text-xs text-sage-600 dark:text-moss-muted">
        Household id: <code className="font-semibold">{hid || '…'}</code> · API base:{' '}
        <code className="font-semibold">{baseUrl || 'set notify URL'}</code>
      </p>

      {session ? (
        <p className="mt-3 text-sm font-semibold text-teal-900 dark:text-teal-200">
          Signed in as {session.email ?? 'member'} ({session.role}) ·{' '}
          <button
            type="button"
            className="font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-200"
            onClick={logout}
          >
            Sign out
          </button>
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={email}
            aria-invalid={Boolean(inlineErr.email)}
            aria-describedby={inlineErr.email ? fieldErrorId('ha-email') : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setInlineErr((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="email"
          />
          <FieldError id={fieldErrorId('ha-email')} message={inlineErr.email} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
          Password (min 8)
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={password}
            aria-invalid={Boolean(inlineErr.password)}
            aria-describedby={inlineErr.password ? fieldErrorId('ha-password') : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setInlineErr((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="new-password"
          />
          <FieldError id={fieldErrorId('ha-password')} message={inlineErr.password} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void register()}>
          Register primary
        </button>
        <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void login()}>
          Sign in
        </button>
        {session?.role === 'owner' ? (
          <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void invite()}>
            Create partner invite
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary btn-secondary-sm font-bold"
          disabled={busy || !email.trim()}
          onClick={() => void requestForgotPassword()}
        >
          Forgot password (primary)
        </button>
        {session?.role === 'owner' ? (
          <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void requestVerifyEmail()}>
            Send verify email
          </button>
        ) : null}
        <button
          type="button"
          className="btn-secondary btn-secondary-sm font-bold"
          disabled={busy || !email.trim()}
          onClick={() => void requestMagicLogin()}
        >
          Email sign-in link
        </button>
      </div>

      {resetTokenFromHash ? (
        <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm font-bold text-sage-900 dark:text-moss-fg">Password reset</p>
          <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">Choose a new password for your primary account.</p>
          <input
            type="password"
            className="mt-2 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            placeholder="New password (min 8)"
            value={newPasswordAfterReset}
            aria-invalid={Boolean(inlineErr.newPassword)}
            aria-describedby={inlineErr.newPassword ? fieldErrorId('ha-new-password') : undefined}
            onChange={(e) => {
              setNewPasswordAfterReset(e.target.value);
              setInlineErr((p) => ({ ...p, newPassword: undefined }));
            }}
            autoComplete="new-password"
          />
          <FieldError id={fieldErrorId('ha-new-password')} message={inlineErr.newPassword} />
          <button
            type="button"
            className="btn-primary btn-primary-sm mt-2 font-bold"
            disabled={busy || newPasswordAfterReset.length < 8}
            onClick={() => void submitPasswordReset()}
          >
            Save new password
          </button>
        </div>
      ) : null}

      <div className="mt-8 border-t border-violet-200/80 pt-5 dark:border-violet-900/40">
        <p className="text-sm font-bold text-sage-900 dark:text-moss-fg">Accept partner invite</p>
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
          Open the invite link on this device or paste the token. Hash clears after accept.
        </p>
        <input
          className="mt-2 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 font-mono text-xs dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
          placeholder="Invite token"
          value={inviteToken}
          aria-invalid={Boolean(inlineErr.inviteToken)}
          aria-describedby={inlineErr.inviteToken ? fieldErrorId('ha-invite') : undefined}
          onChange={(e) => {
            setInviteToken(e.target.value);
            setInlineErr((p) => ({ ...p, inviteToken: undefined }));
          }}
        />
        <FieldError id={fieldErrorId('ha-invite')} message={inlineErr.inviteToken} />
        <input
          className="mt-2 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
          placeholder="Your email (partner)"
          value={partnerEmail}
          aria-invalid={Boolean(inlineErr.partnerEmail)}
          aria-describedby={inlineErr.partnerEmail ? fieldErrorId('ha-partner') : undefined}
          onChange={(e) => {
            setPartnerEmail(e.target.value);
            setInlineErr((p) => ({ ...p, partnerEmail: undefined }));
          }}
          autoComplete="email"
        />
        <FieldError id={fieldErrorId('ha-partner')} message={inlineErr.partnerEmail} />
        <button type="button" className="btn-primary btn-primary-sm mt-2 font-bold" disabled={busy} onClick={() => void accept()}>
          Accept invite
        </button>
      </div>

      <div className="mt-8 border-t border-amber-200/80 pt-5 dark:border-amber-900/40">
        <p className="text-sm font-bold text-sage-900 dark:text-moss-fg">Pairing code</p>
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
          Owner generates a 6-digit code (15 minutes). Partner enters code with their email and password to join the same household id
          as above.
        </p>
        {session?.role === 'owner' ? (
          <button type="button" className="btn-secondary btn-secondary-sm mt-2 font-bold" disabled={busy} onClick={() => void createPairing()}>
            Generate pairing code
          </button>
        ) : null}
        <input
          className="mt-3 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 font-mono text-sm tracking-widest dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
          placeholder="6-digit code"
          inputMode="numeric"
          value={pairDigits}
          aria-invalid={Boolean(inlineErr.pairDigits)}
          aria-describedby={inlineErr.pairDigits ? fieldErrorId('ha-pair-digits') : undefined}
          onChange={(e) => {
            setPairDigits(e.target.value.replace(/\D/g, '').slice(0, 6));
            setInlineErr((p) => ({ ...p, pairDigits: undefined }));
          }}
        />
        <FieldError id={fieldErrorId('ha-pair-digits')} message={inlineErr.pairDigits} />
        <input
          className="mt-2 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
          placeholder="Your email (partner)"
          value={partnerEmail}
          aria-invalid={Boolean(inlineErr.partnerEmail)}
          aria-describedby={inlineErr.partnerEmail ? fieldErrorId('ha-partner-pair') : undefined}
          onChange={(e) => {
            setPartnerEmail(e.target.value);
            setInlineErr((p) => ({ ...p, partnerEmail: undefined }));
          }}
          autoComplete="email"
        />
        <FieldError id={fieldErrorId('ha-partner-pair')} message={inlineErr.partnerEmail} />
        <input
          type="password"
          className="mt-2 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
          placeholder="Choose password (min 8)"
          value={pairPassword}
          aria-invalid={Boolean(inlineErr.pairPassword)}
          aria-describedby={inlineErr.pairPassword ? fieldErrorId('ha-pair-pwd') : undefined}
          onChange={(e) => {
            setPairPassword(e.target.value);
            setInlineErr((p) => ({ ...p, pairPassword: undefined }));
          }}
          autoComplete="new-password"
        />
        <FieldError id={fieldErrorId('ha-pair-pwd')} message={inlineErr.pairPassword} />
        <button type="button" className="btn-primary btn-primary-sm mt-2 font-bold" disabled={busy} onClick={() => void redeemPairing()}>
          Join with pairing code
        </button>
      </div>

      {session?.role === 'owner' ? (
        <div className="mt-8 border-t border-slate-200/90 pt-5 dark:border-moss-border">
          <p className="text-sm font-bold text-sage-900 dark:text-moss-fg">Household API keys</p>
          <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
            Scoped <code className="text-xs">hk_…</code> bearer for notify/state/snapshot on this household. Session still required for
            invites, pairing, and email actions.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void mintBearerKey()}>
              Mint new key
            </button>
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void refreshBearerKeys()}>
              List keys
            </button>
          </div>
          {bearerKeysText ? (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900/90 p-3 font-mono text-[11px] text-teal-100">{bearerKeysText}</pre>
          ) : null}
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-sm text-sage-800 dark:text-moss-subtle">{msg}</p> : null}
    </div>
  );
}
