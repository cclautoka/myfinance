import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  parseInviteTokenFromHash,
  parseResetTokenFromHash,
  postNotifyRelayPublicJson,
  setNotifyRelayHouseholdId,
  readNotifyRelayConfig,
  writeNotifyRelayConfig,
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
import { pushToast } from '../ui/toast/toastBus';
import { applyNotifyEmails } from '../utils/applyNotifyEmails';
import { preloadWorkbookModule } from '../SignedInWorkbook';

type Tab = 'signin' | 'register' | 'partner';
type AuthPanel = 'default' | 'forgot' | 'reset';

function finishAuth(
  member: { email?: string; role?: string; householdId?: string; emailVerified?: boolean },
  token: string,
  onAuthed?: () => void | Promise<void>,
  opts?: { emailVerified?: boolean },
) {
  clearLocalFinanceCache();
  if (member.householdId) setNotifyRelayHouseholdId(member.householdId);
  writeHouseholdSession({
    token,
    householdId: member.householdId!,
    email: member.email,
    role: member.role,
    emailVerified: opts?.emailVerified ?? member.emailVerified ?? true,
  });
  void preloadWorkbookModule();
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
  const [registerPartnerEmail, setRegisterPartnerEmail] = useState('');
  const [registerOwnerSlot, setRegisterOwnerSlot] = useState<'husband' | 'wife'>('husband');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [pairDigits, setPairDigits] = useState('');
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    valid: boolean;
    mode?: 'join' | 'signin';
    householdId?: string;
    partnerEmail?: string;
    needsEmailVerification?: boolean;
    emailVerified?: boolean;
  } | null>(null);
  const [partnerSignInEmail, setPartnerSignInEmail] = useState('');
  const [partnerSignInCode, setPartnerSignInCode] = useState('');
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

  useEffect(() => {
    const token = inviteToken.trim();
    if (!token) {
      setInvitePreview(null);
      return;
    }
    let cancelled = false;
    setInvitePreviewLoading(true);
    void (async () => {
      try {
        const j = (await postNotifyRelayPublicJson('/v1/household/auth/invite-preview', { token })) as {
          valid?: boolean;
          mode?: 'join' | 'signin';
          householdId?: string;
          partnerEmail?: string;
          needsEmailVerification?: boolean;
          emailVerified?: boolean;
        };
        if (cancelled) return;
        if (j.valid && j.partnerEmail) {
          setPartnerEmail(j.partnerEmail);
          setPartnerSignInEmail(j.partnerEmail);
        }
        if (j.valid && j.householdId) setNotifyRelayHouseholdId(j.householdId);
        setInvitePreview({
          valid: Boolean(j.valid),
          mode: j.mode,
          householdId: j.householdId,
          partnerEmail: j.partnerEmail,
          needsEmailVerification: j.needsEmailVerification,
          emailVerified: j.emailVerified,
        });
      } catch {
        if (!cancelled) setInvitePreview({ valid: false });
      } finally {
        if (!cancelled) setInvitePreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const hasInviteToken = Boolean(inviteToken.trim());
  /** Invite UI only while loading preview or when the link is still usable (join or return sign-in). */
  const partnerInviteMode =
    hasInviteToken && (invitePreviewLoading || Boolean(invitePreview?.valid));
  const partnerInviteSignInMode = partnerInviteMode && invitePreview?.valid && invitePreview.mode === 'signin';
  const inviteLinkInvalid = hasInviteToken && !invitePreviewLoading && invitePreview?.valid === false;

  const clearInviteHashAndOpenPartnerSignIn = () => {
    setInviteToken('');
    setInvitePreview(null);
    setTab('partner');
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
  };

  const partnerCanJoin =
    invitePreview?.valid &&
    invitePreview.mode !== 'signin' &&
    (!invitePreview.needsEmailVerification || invitePreview.emailVerified);
  const partnerCanSignInFromInvite =
    partnerInviteSignInMode && (!invitePreview?.needsEmailVerification || invitePreview.emailVerified);

  const register = async () => {
    setBusy(true);
    try {
      const newHid = generateHouseholdId();
      setNotifyRelayHouseholdId(newHid);
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/register', {
        householdId: newHid,
        email,
        password,
        householdMode: mode,
        ...(mode === 'couple' ? { ownerSlot: registerOwnerSlot } : {}),
        ...(mode === 'couple' && registerPartnerEmail.trim()
          ? { partnerEmail: registerPartnerEmail.trim() }
          : {}),
      })) as {
        needsEmailVerification?: boolean;
        partnerVerificationSent?: boolean;
        notifyEmails?: { husbandEmail?: string; wifeEmail?: string };
        token?: string;
        member?: { email?: string; role?: string; householdId?: string };
      };
      applyNotifyEmails(j.notifyEmails);
      writeNotifyRelayConfig({
        ...readNotifyRelayConfig(),
        householdId: newHid,
      });
      if (j.needsEmailVerification) {
        const partnerNote =
          mode === 'couple' && registerPartnerEmail.trim()
            ? j.partnerVerificationSent
              ? ' Your partner was emailed a verification link too.'
              : ' Add your partner’s email in Tools after you sign in.'
            : '';
        pushToast({
          type: 'success',
          message: `Check your inbox for a verification link. After you verify, sign in with the same email and password.${partnerNote}`,
        });
        setTab('signin');
      } else if (j.token && j.member?.householdId) {
        pushToast({ type: 'success', message: 'Account created — welcome.' });
        finishAuth(j.member, j.token as string, onAuthed);
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);
    try {
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/login', {
        email,
        password,
      })) as {
        token?: string;
        needsEmailVerification?: boolean;
        notifyEmails?: { husbandEmail?: string; wifeEmail?: string };
        member?: { email?: string; role?: string; householdId?: string; emailVerified?: boolean };
      };
      if (j.token && j.member?.householdId) {
        applyNotifyEmails(j.notifyEmails);
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
        pushToast({ type: 'success', message: 'Signed in.' });
        finishAuth(j.member, j.token, onAuthed, {
          emailVerified: j.needsEmailVerification ? false : Boolean(j.member.emailVerified ?? true),
        });
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const requestForgot = async () => {
    if (!email.trim()) {
      pushToast({ type: 'error', message: 'Enter your account email first.' });
      return;
    }
    setBusy(true);
    try {
      await postNotifyRelayPublicJson('/v1/household/auth/request-password-reset', {
        email: email.trim(),
      });
      pushToast({
        type: 'success',
        message: 'If an owner account exists for that email, a reset link was sent (check spam).',
      });
      setAuthPanel('default');
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTokenFromHash) return;
    setBusy(true);
    try {
      await postNotifyRelayPublicJson('/v1/household/auth/reset-password', {
        token: resetTokenFromHash,
        newPassword: newPasswordAfterReset,
      });
      pushToast({
        type: 'success',
        message: 'Password updated — sign in with your new password. Check your inbox for a confirmation email.',
      });
      setResetTokenFromHash(null);
      setAuthPanel('default');
      setNewPasswordAfterReset('');
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const joinAsPartner = async () => {
    const digits = pairDigits.replace(/\D/g, '');
    if (!partnerEmail.trim().includes('@')) {
      pushToast({ type: 'error', message: 'Enter your email address.' });
      return;
    }
    if (digits.length !== 6) {
      pushToast({ type: 'error', message: 'Enter the 6-digit pairing code from your partner.' });
      return;
    }
    setBusy(true);
    try {
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/accept-invite', {
        token: inviteToken.trim(),
        email: partnerEmail.trim(),
        code: digits,
      })) as {
        token?: string;
        needsEmailVerification?: boolean;
        notifyEmails?: { husbandEmail?: string; wifeEmail?: string };
        member?: { email?: string; role?: string; householdId?: string };
      };
      applyNotifyEmails(j.notifyEmails);
      if (j.needsEmailVerification) {
        pushToast({
          type: 'success',
          message: 'Check your email to verify, then reload this page and enter the pairing code.',
        });
        return;
      }
      if (j.token && j.member?.householdId) {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
        pushToast({ type: 'success', message: 'Joined household — welcome.' });
        finishAuth(j.member, j.token, onAuthed);
      }
    } catch (e) {
      const err = e as Error & { message?: string };
      const msg = String(err?.message ?? e);
      if (msg.includes('EMAIL_NOT_VERIFIED') || msg.toLowerCase().includes('verify your email')) {
        pushToast({
          type: 'error',
          message: 'Verify your email first, then reload this page and enter the pairing code.',
        });
      } else {
        pushToast({ type: 'error', message: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  const partnerSignIn = async (opts?: { email?: string; code?: string; householdId?: string }) => {
    const signEmail = (opts?.email ?? partnerSignInEmail).trim();
    const digits = (opts?.code ?? partnerSignInCode).replace(/\D/g, '');
    const hid =
      (opts?.householdId ?? invitePreview?.householdId ?? readNotifyRelayConfig().householdId ?? '').trim();
    if (!signEmail.includes('@')) {
      pushToast({ type: 'error', message: 'Enter your email address.' });
      return;
    }
    if (digits.length !== 6) {
      pushToast({ type: 'error', message: 'Enter the 6-digit pairing code from your partner.' });
      return;
    }
    setBusy(true);
    try {
      const j = (await postNotifyRelayPublicJson('/v1/household/auth/partner-sign-in', {
        ...(hid ? { householdId: hid } : {}),
        email: signEmail,
        code: digits,
      })) as {
        token?: string;
        notifyEmails?: { husbandEmail?: string; wifeEmail?: string };
        member?: { email?: string; role?: string; householdId?: string; emailVerified?: boolean };
      };
      applyNotifyEmails(j.notifyEmails);
      if (j.token && j.member?.householdId) {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
        pushToast({ type: 'success', message: 'Signed in — welcome back.' });
        finishAuth(j.member, j.token, onAuthed);
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const reloadInvitePage = () => {
    const token = inviteToken.trim();
    const path = window.location.pathname + window.location.search;
    window.location.href = token ? `${path}#invite=${encodeURIComponent(token)}` : path;
  };

  const emailErr = email.trim() && !email.includes('@') ? 'Enter a valid email.' : null;
  const pwdErr = tab === 'register' && password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters.' : null;
  const compact = variant === 'embedded';
  const authTabOptions = compact
    ? ([
        { id: 'signin' as const, label: 'Owner' },
        { id: 'register' as const, label: 'Register' },
        { id: 'partner' as const, label: 'Partner' },
      ] as const)
    : ([
        { id: 'signin' as const, label: 'Owner sign in' },
        { id: 'register' as const, label: 'Register' },
        { id: 'partner' as const, label: 'Partner sign-in' },
      ] as const);

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
            {partnerInviteMode
              ? partnerInviteSignInMode
                ? 'Partner sign-in'
                : 'Join household'
              : tab === 'partner'
                ? 'Partner sign-in'
                : compact
                  ? 'Sign in or register'
                  : 'Household sign-in'}
          </h2>
          {!compact && !partnerInviteMode ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-moss-muted">
              {tab === 'register'
                ? 'Create your household account. Couple mode lets you add your partner’s email for verification.'
                : 'Sign in with the email and password you registered.'}
            </p>
          ) : null}
          {partnerInviteMode && !partnerInviteSignInMode ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-moss-muted">
              Enter your email and the pairing code your partner shared with the invite link.
            </p>
          ) : null}
          {partnerInviteSignInMode || tab === 'partner' ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-moss-muted">
              Use the email you joined with and your household&apos;s current pairing code — no invite link needed.
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

      {!partnerInviteMode ? (
        <div className={compact ? 'mt-4 w-full min-w-0' : 'mt-6 max-w-md'}>
          <SegmentedButtonGroup
            aria-label="Sign in or register"
            value={tab}
            onChange={setTab}
            options={[...authTabOptions]}
            size={compact ? 'compact' : 'default'}
          />
        </div>
      ) : null}

      {inviteLinkInvalid ? (
        <div
          className="mt-4 rounded-xl border border-amber-400/90 bg-amber-50/95 px-3 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold">This invite link was already used</p>
          <p className="mt-1 text-xs leading-relaxed">
            First-time join needs a fresh invite from your partner. If you already joined, use partner sign-in with your
            email and the current pairing code.
          </p>
          <button
            type="button"
            className="btn-primary btn-primary-sm mt-3 font-bold"
            onClick={clearInviteHashAndOpenPartnerSignIn}
          >
            Partner sign-in
          </button>
        </div>
      ) : null}

      <div
        className={
          compact
            ? 'mt-4 space-y-4 rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-4 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25'
            : 'mt-6 space-y-4 rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25'
        }
      >
        {!partnerInviteMode && tab === 'register' ? (
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
        ) : null}

        {partnerInviteMode ? (
          <div className="space-y-3 rounded-xl border border-teal-200/80 bg-teal-50/50 p-3 dark:border-teal-900/40 dark:bg-teal-950/25">
            <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">
              {partnerInviteSignInMode ? 'Already in this household' : 'Partner join'}
            </p>
            {!partnerInviteSignInMode ? (
              <p className="text-xs text-teal-900/90 dark:text-teal-200/85">
                This invite link does not expire. Check your inbox for a partner verification email first.
              </p>
            ) : (
              <p className="text-xs text-teal-900/90 dark:text-teal-200/85">
                You already joined with this invite. Sign in with your email and the current pairing code from your
                partner — the link is only needed once.
              </p>
            )}
            {invitePreviewLoading ? (
              <p className="text-xs text-slate-600 dark:text-moss-muted">Checking invite…</p>
            ) : null}
            {!invitePreviewLoading && invitePreview && !invitePreview.valid ? (
              <p className="rounded-lg border border-red-300/80 bg-red-50/90 px-3 py-2 text-sm text-red-950 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                This invite link is invalid. Ask your partner for a new invite, or use Partner sign-in if you already
                joined.
              </p>
            ) : null}
            {!invitePreviewLoading && invitePreview?.valid && invitePreview.needsEmailVerification && !invitePreview.emailVerified ? (
              <div
                className="rounded-lg border border-amber-400/90 bg-amber-50/95 px-3 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
                role="status"
              >
                <p className="font-semibold">Verify your email first</p>
                <p className="mt-1 text-xs leading-relaxed">
                  We sent a verification message to{' '}
                  <strong>{invitePreview.partnerEmail ?? partnerEmail}</strong>. Open that email, click verify, then
                  reload this page to enter your pairing code.
                </p>
                <button type="button" className="btn-secondary btn-secondary-sm mt-3 font-bold" onClick={reloadInvitePage}>
                  Reload page
                </button>
              </div>
            ) : null}
            {partnerCanJoin ? (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Your email
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg/80"
                    value={partnerEmail}
                    readOnly
                    autoComplete="email"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Pairing code (6 digits)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest dark:border-moss-border dark:bg-moss-bg"
                    placeholder="000000"
                    inputMode="numeric"
                    value={pairDigits}
                    onChange={(e) => setPairDigits(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary btn-primary-sm font-bold"
                  disabled={busy}
                  onClick={() => void joinAsPartner()}
                >
                  Join household
                </button>
              </>
            ) : null}
            {partnerCanSignInFromInvite ? (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Your email
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg/80"
                    value={partnerSignInEmail}
                    readOnly
                    autoComplete="email"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Pairing code (6 digits)
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest dark:border-moss-border dark:bg-moss-bg"
                    placeholder="000000"
                    inputMode="numeric"
                    value={partnerSignInCode}
                    onChange={(e) => setPartnerSignInCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary btn-primary-sm font-bold"
                  disabled={busy}
                  onClick={() =>
                    void partnerSignIn({
                      email: partnerSignInEmail,
                      code: partnerSignInCode,
                      householdId: invitePreview?.householdId,
                    })
                  }
                >
                  Sign in
                </button>
              </>
            ) : null}
          </div>
        ) : tab === 'partner' ? (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
              Your email
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={partnerSignInEmail}
                onChange={(e) => setPartnerSignInEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
              Pairing code (6 digits)
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm tracking-widest dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                placeholder="000000"
                inputMode="numeric"
                value={partnerSignInCode}
                onChange={(e) => setPartnerSignInCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
              />
            </label>
          </>
        ) : (
          <>
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
              <p className="text-xs text-slate-600 dark:text-moss-muted">
                Joined as a partner?{' '}
                <button
                  type="button"
                  className="font-semibold text-teal-800 underline underline-offset-2 dark:text-teal-300"
                  onClick={() => setTab('partner')}
                >
                  Sign in with pairing code
                </button>
              </p>
            ) : null}
            {tab === 'register' && mode === 'couple' ? (
              <fieldset>
                <legend className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-moss-muted">
                  I am
                </legend>
                <div className="mt-2 max-w-md">
                  <SegmentedChoice
                    name="register-owner-slot"
                    aria-label="Your role in the household"
                    value={registerOwnerSlot}
                    onChange={setRegisterOwnerSlot}
                    options={[
                      { id: 'husband', label: 'Husband' },
                      { id: 'wife', label: 'Wife' },
                    ]}
                  />
                </div>
              </fieldset>
            ) : null}
            {tab === 'register' && mode === 'couple' ? (
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Partner&apos;s email
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={registerPartnerEmail}
                  onChange={(e) => setRegisterPartnerEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="They’ll get a verification email"
                />
                <p className="mt-1 text-[11px] font-normal normal-case text-slate-500 dark:text-moss-muted">
                  Optional now — pre-fills Tools and lets them verify before you send a pairing invite.
                </p>
              </label>
            ) : null}
          </>
        )}

        {authPanel === 'forgot' && !partnerInviteMode ? (
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
                onClick={() => setAuthPanel('default')}
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

        {authPanel === 'default' && !partnerInviteMode ? (
          <div className="flex flex-wrap gap-2">
            {tab === 'register' ? (
              <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void register()}>
                Create account
              </button>
            ) : tab === 'partner' ? (
              <button
                type="button"
                className="btn-primary btn-primary-sm font-bold"
                disabled={busy}
                onClick={() => void partnerSignIn()}
              >
                Partner sign in
              </button>
            ) : (
              <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void login()}>
                Sign in
              </button>
            )}
            {tab === 'signin' ? (
              <button
                type="button"
                className="btn-secondary btn-secondary-sm font-bold"
                disabled={busy}
                onClick={() => setAuthPanel('forgot')}
              >
                Forgot password
              </button>
            ) : null}
          </div>
        ) : null}

        {compact ? (
          <p className="text-xs text-slate-500 dark:text-moss-muted">
            {tab === 'partner'
              ? 'Use the email you joined with and the 6-digit pairing code from your partner (Tools on their account).'
              : 'New accounts start with a blank worksheet. Partners: tap the Partner tab above.'}
          </p>
        ) : (
          <p className="text-xs text-slate-500 dark:text-moss-muted">
            Partner invites and pairing codes are under{' '}
            <strong className="text-slate-700 dark:text-moss-subtle">Tools</strong> after you enter the dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
