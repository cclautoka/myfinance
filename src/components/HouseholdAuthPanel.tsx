import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parseResetTokenFromHash,
  readNotifyRelayConfig,
  syncHouseholdIdFromSession,
  writeNotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import { postHouseholdApiJson } from '../utils/householdApiJson';
import { resolveHouseholdApiBase } from '../utils/householdApiBase';
import { clearHouseholdSession, readHouseholdSession, writeHouseholdSession } from '../utils/householdSession';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';
import { SegmentedChoice } from './ui/SegmentedChoice';
import { pushToast } from '../ui/toast/toastBus';
import { PartnerInviteModal } from './PartnerInviteModal';
import { resolvePartnerEmailForInvite } from '../utils/resolvePartnerEmail';
import { applyNotifyEmails, fetchAndApplyNotifyEmails } from '../utils/applyNotifyEmails';
import { clearLocalFinanceCache } from '../utils/clearLocalFinanceCache';
import { preloadWorkbookModule } from '../SignedInWorkbook';

function isValidEmail(v: string) {
  const t = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type AuthFieldErrors = Partial<{
  email: string;
  password: string;
  newPassword: string;
}>;

type ActivePairing = { code: string };

function hasPairingCode(p: ActivePairing | null): p is ActivePairing {
  return Boolean(p?.code);
}

export function HouseholdAuthPanel({
  onAuthChange,
  onNotifyConfigChanged,
}: {
  onAuthChange?: () => void;
  /** Called after the partner email is edited so the parent can push the updated snapshot to the server. */
  onNotifyConfigChanged?: () => void;
}) {
  const session = typeof window !== 'undefined' ? readHouseholdSession() : null;
  const hid = useMemo(
    () => (typeof window !== 'undefined' ? syncHouseholdIdFromSession() : ''),
    [session?.householdId],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetTokenFromHash, setResetTokenFromHash] = useState<string | null>(null);
  const [newPasswordAfterReset, setNewPasswordAfterReset] = useState('');
  const [inlineErr, setInlineErr] = useState<AuthFieldErrors>({});
  const [activePairing, setActivePairing] = useState<ActivePairing | null>(null);
  const [pairingHighlight, setPairingHighlight] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalUrl, setInviteModalUrl] = useState('');
  const [inviteModalPartnerEmail, setInviteModalPartnerEmail] = useState('');
  const [inviteVerificationSent, setInviteVerificationSent] = useState(false);
  const [inviteJoinEmailSent, setInviteJoinEmailSent] = useState(false);
  const [pairingCopied, setPairingCopied] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [configTick, setConfigTick] = useState(0);
  const [editingPartnerEmail, setEditingPartnerEmail] = useState(false);
  const [partnerEmailDraft, setPartnerEmailDraft] = useState('');
  const [partnerEmailErr, setPartnerEmailErr] = useState<string | null>(null);
  const pairingSectionRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<HouseholdMode>(() => {
    try {
      const v = localStorage.getItem(HOUSEHOLD_MODE_KEY);
      return v === 'single' ? 'single' : 'couple';
    } catch {
      return 'couple';
    }
  });

  const isOwner = session?.role === 'owner';
  const isPartner = session?.role === 'partner';
  const signedIn = Boolean(session?.token);

  useEffect(() => {
    if (session?.email) setEmail(session.email);
  }, [session?.email]);

  useEffect(() => {
    const rt = parseResetTokenFromHash();
    if (rt) setResetTokenFromHash(rt);
  }, []);

  useEffect(() => {
    if (!pairingHighlight) return;
    const t = window.setTimeout(() => setPairingHighlight(false), 4000);
    return () => clearTimeout(t);
  }, [pairingHighlight]);

  useEffect(() => {
    if (!pairingCopied) return;
    const t = window.setTimeout(() => setPairingCopied(false), 2000);
    return () => clearTimeout(t);
  }, [pairingCopied]);

  const persistMode = (m: HouseholdMode) => {
    setMode(m);
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const postJson = useCallback(async (path: string, body: Record<string, unknown>, withInviteAuth?: boolean) => {
    return postHouseholdApiJson(path, body, withInviteAuth ? { auth: 'session-or-secret' } : undefined);
  }, []);

  useEffect(() => {
    if (!signedIn || !isOwner || !hid) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = (await postJson('/v1/household/pairing/create', { householdId: hid }, true)) as { code?: string };
        if (!cancelled && j.code) setActivePairing({ code: String(j.code) });
      } catch {
        /* ignore — owner can generate manually */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, isOwner, hid, postJson]);

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
    try {
      const j = (await postJson('/v1/household/auth/register', {
        householdId: hid,
        email,
        password,
      })) as {
        token?: string;
        needsEmailVerification?: boolean;
        notifyEmails?: { husbandEmail?: string; wifeEmail?: string };
        member?: { email?: string; role?: string; householdId?: string; emailVerified?: boolean };
      };
      if (j.needsEmailVerification) {
        pushToast({
          type: 'success',
          message: 'Check your email to verify, then sign in here with the same password.',
        });
      } else if (j.token && j.member?.householdId) {
        applyNotifyEmails(j.notifyEmails);
        clearLocalFinanceCache();
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
          emailVerified: Boolean(j.member.emailVerified ?? true),
        });
        void preloadWorkbookModule();
        pushToast({ type: 'success', message: 'Registered and signed in on this device.' });
        onAuthChange?.();
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
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
    try {
      const j = (await postJson('/v1/household/auth/login', {
        householdId: hid,
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
        writeHouseholdSession({
          token: j.token,
          householdId: j.member.householdId,
          email: j.member.email,
          role: j.member.role,
          emailVerified: j.needsEmailVerification ? false : Boolean(j.member.emailVerified ?? true),
        });
        void fetchAndApplyNotifyEmails();
        void preloadWorkbookModule();
      }
      pushToast({ type: 'success', message: 'Signed in.' });
      onAuthChange?.();
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const createPairing = useCallback(
    async (opts?: { regenerate?: boolean }): Promise<ActivePairing | null> => {
    const body: Record<string, unknown> = { householdId: hid };
    if (opts?.regenerate) body.regenerate = true;
    const { secret } = readNotifyRelayConfig();
    const sess = readHouseholdSession();
    if (!sess?.token && secret.trim()) {
      body.ownerEmail = email.trim() || readNotifyRelayConfig().husbandEmail;
    }
    const j = (await postJson('/v1/household/pairing/create', body, true)) as {
      code?: string;
    };
    if (!j.code) return null;
    const next: ActivePairing = { code: j.code };
    setActivePairing(next);
    return next;
  },
    [email, hid, postJson],
  );

  const highlightPairingSection = () => {
    setPairingHighlight(true);
    pairingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const buildInviteLink = (j: {
    inviteUrl?: string | null;
    token?: string;
    inviteHashFragment?: string;
  }) =>
    j.inviteUrl ||
    (j.inviteHashFragment
      ? `${window.location.origin}${window.location.pathname}#${j.inviteHashFragment}`
      : j.token
        ? `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(j.token)}`
        : '');

  const openInviteModal = (
    link: string,
    partnerEmail: string,
    opts: { verificationEmailSent?: boolean; joinEmailSent?: boolean },
  ) => {
    setInviteModalUrl(link);
    setInviteModalPartnerEmail(partnerEmail);
    setInviteVerificationSent(Boolean(opts.verificationEmailSent));
    setInviteJoinEmailSent(Boolean(opts.joinEmailSent));
    setInviteModalOpen(true);
  };

  const fetchPartnerInvite = async (sendEmail: boolean) => {
    setBusy(true);
    try {
      const pairing = hasPairingCode(activePairing) ? activePairing : await createPairing();
      if (!pairing) {
        highlightPairingSection();
        pushToast({ type: 'error', message: 'Generate a pairing code first, then try again.' });
        return;
      }
      const partnerEmail = resolvePartnerEmailForInvite(session?.email);
      if (!partnerEmail) {
        pushToast({
          type: 'error',
          message: 'Set both partner emails under Email summaries before sharing a partner link.',
        });
        return;
      }
      const j = (await postJson(
        '/v1/household/auth/invite',
        { householdId: hid, partnerEmail, sendEmail },
        true,
      )) as {
        inviteUrl?: string | null;
        token?: string;
        inviteHashFragment?: string;
        partnerEmail?: string;
        verificationEmailSent?: boolean;
        joinEmailSent?: boolean;
      };
      const link = buildInviteLink(j);
      if (!link) {
        pushToast({ type: 'error', message: 'Could not build invite link.' });
        return;
      }
      openInviteModal(link, j.partnerEmail ?? partnerEmail, {
        verificationEmailSent: j.verificationEmailSent,
        joinEmailSent: j.joinEmailSent,
      });
      if (sendEmail) {
        if (j.verificationEmailSent) {
          pushToast({
            type: 'success',
            message: `Verification email sent to ${j.partnerEmail ?? partnerEmail}.`,
          });
        } else if (j.joinEmailSent) {
          pushToast({
            type: 'success',
            message: `Partner invite email sent to ${j.partnerEmail ?? partnerEmail}.`,
          });
        }
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
      highlightPairingSection();
    } finally {
      setBusy(false);
    }
  };

  const copyPairingCode = async () => {
    if (!hasPairingCode(activePairing)) return;
    try {
      await navigator.clipboard.writeText(activePairing.code);
      setPairingCopied(true);
    } catch {
      pushToast({ type: 'error', message: 'Could not copy pairing code.' });
    }
  };

  const requestForgotPassword = async () => {
    const addr = (session?.email ?? email).trim();
    if (!addr) {
      pushToast({ type: 'error', message: 'No email on file for this account.' });
      return;
    }
    setBusy(true);
    try {
      await postJson('/v1/household/auth/request-password-reset', { householdId: hid, email: addr });
      pushToast({ type: 'success', message: 'If that primary email exists, a reset link was sent.' });
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
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
    try {
      await postJson('/v1/household/auth/reset-password', {
        token: resetTokenFromHash,
        newPassword: newPasswordAfterReset,
      });
      pushToast({
        type: 'success',
        message: 'Password updated — sign in with your new password.',
      });
      setResetTokenFromHash(null);
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

  const copyHouseholdId = async () => {
    if (!hid) return;
    try {
      await navigator.clipboard.writeText(hid);
      pushToast({ type: 'success', message: 'Household id copied.' });
    } catch {
      pushToast({ type: 'error', message: 'Could not copy household id.' });
    }
  };

  const logout = () => {
    clearHouseholdSession();
    pushToast({ type: 'success', message: 'Signed out.' });
    onAuthChange?.();
  };

  // Recompute when the local notify config changes (configTick) or the session email changes.
  const currentPartnerEmail = useMemo(
    () => resolvePartnerEmailForInvite(session?.email),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configTick forces re-read of localStorage config
    [session?.email, configTick],
  );

  const beginEditPartnerEmail = () => {
    setPartnerEmailDraft(currentPartnerEmail);
    setPartnerEmailErr(null);
    setEditingPartnerEmail(true);
  };

  /**
   * The partner email doubles as their login address (they join with the exact invite email) and the
   * notification recipient, so writing it here keeps both in sync. Owner keeps their own slot; the
   * partner takes the other.
   */
  const savePartnerEmail = async () => {
    const next = partnerEmailDraft.trim();
    if (!isValidEmail(next)) {
      setPartnerEmailErr('Enter a valid email address.');
      return;
    }
    const owner = (session?.email ?? '').trim().toLowerCase();
    if (next.toLowerCase() === owner) {
      setPartnerEmailErr('Partner email must differ from your own.');
      return;
    }
    setBusy(true);
    setPartnerEmailErr(null);
    try {
      // Update the partner account row on the server (login email), then mirror into the local
      // notify config (notification email) so login and notifications stay linked.
      await postJson('/v1/household/partner/set-email', { householdId: hid, email: next }, true);
      const cfg = readNotifyRelayConfig();
      if (owner && cfg.wifeEmail.trim().toLowerCase() === owner) {
        writeNotifyRelayConfig({ ...cfg, husbandEmail: next });
      } else {
        const husband = cfg.husbandEmail.trim() || (session?.email ?? '');
        writeNotifyRelayConfig({ ...cfg, husbandEmail: husband, wifeEmail: next });
      }
      setEditingPartnerEmail(false);
      setConfigTick((n) => n + 1);
      onNotifyConfigChanged?.();
      pushToast({
        type: 'success',
        message: 'Partner email updated. They can sign in now with that email + the pairing code.',
      });
    } catch (e) {
      setPartnerEmailErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const generatePairingClick = async () => {
    setBusy(true);
    try {
      const p = await createPairing({ regenerate: true });
      if (p) {
        pushToast({
          type: 'success',
          message: `Pairing code: ${p.code} — does not expire. Share with your partner.`,
        });
      }
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 text-slate-900 shadow-md shadow-slate-900/10 dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:text-moss-fg dark:shadow-black/30">
      <h4 className="font-display text-base font-bold text-sage-900 dark:text-moss-fg">Household sign-in (server)</h4>
      <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Owners sign in with email and password. Partners join with an invite link plus a pairing code — no password
        required. When email verification is enabled on the server, both owner and partner must verify their inbox before
        full access.
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

      <div className="mt-4 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 dark:border-moss-border dark:bg-moss-bg/50">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600 dark:text-moss-muted">
          Household id
        </p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-sage-900 dark:text-moss-fg">{hid || '…'}</p>
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
          Same id for everyone in this household. API:{' '}
          <code className="font-semibold">{resolveHouseholdApiBase() || 'set notify URL'}</code>
        </p>
        <button type="button" className="btn-secondary btn-secondary-sm mt-2 font-bold" disabled={!hid} onClick={() => void copyHouseholdId()}>
          Copy household id
        </button>
      </div>

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

      {!signedIn ? (
        <>
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
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={busy || !email.trim()}
              onClick={() => void requestForgotPassword()}
            >
              Forgot password
            </button>
          </div>
        </>
      ) : null}

      {signedIn && isOwner ? (
        <div
          ref={pairingSectionRef}
          id="household-partner-access"
          className={`mt-8 border-t border-violet-200/80 pt-5 transition-shadow dark:border-violet-900/40 ${
            pairingHighlight ? 'rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-moss-surface' : ''
          }`}
        >
          <p className="text-sm font-bold text-sage-900 dark:text-moss-fg">Partner access</p>
          <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
            Generate a pairing code, then create an invite link. Your partner opens the link and enters their email plus this
            code.
          </p>

          <div className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 dark:border-moss-border dark:bg-moss-bg/50">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600 dark:text-moss-muted">
              Partner email
            </p>
            <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
              This is the address your partner uses to join/sign in and where their notifications go — kept in sync.
            </p>
            {editingPartnerEmail ? (
              <div className="mt-2">
                <input
                  className="w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                  placeholder="partner@example.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={Boolean(partnerEmailErr)}
                  aria-describedby={partnerEmailErr ? fieldErrorId('ha-partner-email') : undefined}
                  value={partnerEmailDraft}
                  onChange={(e) => {
                    setPartnerEmailDraft(e.target.value);
                    setPartnerEmailErr(null);
                  }}
                />
                <FieldError id={fieldErrorId('ha-partner-email')} message={partnerEmailErr ?? undefined} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary btn-primary-sm font-bold"
                    disabled={busy}
                    onClick={() => void savePartnerEmail()}
                  >
                    {busy ? 'Saving…' : 'Save partner email'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-sm font-bold"
                    disabled={busy}
                    onClick={() => {
                      setEditingPartnerEmail(false);
                      setPartnerEmailErr(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-sm font-semibold text-sage-900 dark:text-moss-fg">
                  {currentPartnerEmail || 'Not set'}
                </span>
                <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={beginEditPartnerEmail}>
                  {currentPartnerEmail ? 'Change' : 'Set partner email'}
                </button>
              </div>
            )}
          </div>
          {hasPairingCode(activePairing) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="font-mono text-xl font-bold tracking-[0.3em] text-teal-800 dark:text-teal-200">
                {activePairing.code}
              </p>
              <button
                type="button"
                className="btn-secondary btn-secondary-sm font-bold"
                disabled={busy}
                onClick={() => void copyPairingCode()}
              >
                {pairingCopied ? 'Copied' : 'Copy code'}
              </button>
              <span className="text-xs font-medium text-sage-600 dark:text-moss-muted">does not expire</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">No pairing code yet — generate one below.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={busy}
              onClick={() => void generatePairingClick()}
            >
              Generate pairing code
            </button>
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={busy}
              onClick={() => void fetchPartnerInvite(false)}
            >
              Show partner link
            </button>
            <button
              type="button"
              className="btn-primary btn-primary-sm font-bold"
              disabled={busy}
              onClick={() => void fetchPartnerInvite(true)}
            >
              Email partner link
            </button>
          </div>
        </div>
      ) : null}

      {signedIn && isPartner ? (
        <div className="mt-6 rounded-xl border border-teal-200/80 bg-teal-50/40 p-4 dark:border-teal-900/40 dark:bg-teal-950/25">
          <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">Partner account</p>
          <p className="mt-1 text-xs text-teal-900/90 dark:text-teal-200/85">
            You joined without a password. Open the invite link your partner shared to sign in on another device.
          </p>
        </div>
      ) : null}

      {signedIn && isOwner ? (
        <details className="mt-6 group" open={securityOpen} onToggle={(e) => setSecurityOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-sm font-bold text-sage-900 dark:text-moss-fg">Account security</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={() => void requestForgotPassword()}>
              Forgot password
            </button>
          </div>
        </details>
      ) : null}

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

      <PartnerInviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteUrl={inviteModalUrl}
        pairingCode={hasPairingCode(activePairing) ? activePairing.code : ''}
        partnerEmail={inviteModalPartnerEmail}
        verificationEmailSent={inviteVerificationSent}
        joinEmailSent={inviteJoinEmailSent}
      />
    </div>
  );
}
