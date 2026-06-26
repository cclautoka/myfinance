import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySetupFromUrlHash,
  readNotifyRelayConfig,
  resolveNotifyRelayUrl,
  setNotifyRelayHouseholdId,
  writeNotifyRelayConfig,
  type NotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import {
  buildSaveEmailDigest,
  pocketLeftSoFar,
  postNotifyRelay,
  postSnapshotRelay,
  buildSnapshotForReminders,
} from '../utils/notifyRelay';
import type { FinanceState } from '../types/finance';
import { HouseholdAuthPanel } from './HouseholdAuthPanel';
import { readHouseholdSession } from '../utils/householdSession';
import {
  buildReminderCronCurl,
  createHouseholdBearerKey,
} from '../utils/householdBearerKey';
import { fetchAndApplyNotifyEmails } from '../utils/applyNotifyEmails';
import { pushToast } from '../ui/toast/toastBus';
import { readHouseholdMode } from '../setup/setupCompletion';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';

export function NotifyRelaySettings({
  state,
  onReloadFromServer,
}: {
  state: FinanceState;
  onReloadFromServer?: () => Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }>;
}) {
  const [cfg, setCfg] = useState<NotifyRelayConfig>(() => {
    if (typeof window === 'undefined') {
      return { enabled: false, url: resolveNotifyRelayUrl(), secret: '', husbandEmail: '', wifeEmail: '', householdId: '' };
    }
    const sess = readHouseholdSession();
    const base = readNotifyRelayConfig();
    if (sess?.householdId) {
      base.householdId = sess.householdId;
      setNotifyRelayHouseholdId(sess.householdId);
    }
    const prefill = applySetupFromUrlHash();
    return prefill ? { ...base, ...prefill, url: resolveNotifyRelayUrl() } : base;
  });
  const [msg, setMsg] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return applySetupFromUrlHash()
      ? 'Setup link applied — sign in on this device, then reload from server.'
      : null;
  });
  const [busy, setBusy] = useState(false);
  const [cronKeyBusy, setCronKeyBusy] = useState(false);
  const [cronKeyReveal, setCronKeyReveal] = useState<{ key: string; curl: string } | null>(null);
  const [cronAdvancedOpen, setCronAdvancedOpen] = useState(false);
  const [editingRecipients, setEditingRecipients] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const stateRef = useRef(state);
  const snapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash.includes('setup=1')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sess = readHouseholdSession();
    if (!sess?.token) return;
    void fetchAndApplyNotifyEmails().then(() => {
      setCfg({ ...readNotifyRelayConfig(), url: resolveNotifyRelayUrl() });
    });
  }, [authTick]);

  useEffect(
    () => () => {
      if (snapshotPushTimerRef.current !== null) clearTimeout(snapshotPushTimerRef.current);
    },
    [],
  );

  const persist = useCallback((next: NotifyRelayConfig) => {
    const normalized: NotifyRelayConfig = { ...next, url: resolveNotifyRelayUrl() };
    setCfg(normalized);
    writeNotifyRelayConfig(normalized);
    const hid = normalized.householdId.trim();
    if (!normalized.enabled || !hid) return;
    const canAuth = Boolean(normalized.secret.trim()) || Boolean(readHouseholdSession()?.token);
    if (!canAuth) return;
    if (snapshotPushTimerRef.current !== null) clearTimeout(snapshotPushTimerRef.current);
    snapshotPushTimerRef.current = setTimeout(() => {
      snapshotPushTimerRef.current = null;
      void postSnapshotRelay(buildSnapshotForReminders(stateRef.current)).then((r) => {
        if (!r.ok && typeof console !== 'undefined') console.warn('[notify relay snapshot]', r.error);
      });
    }, 700);
  }, []);

  const testSend = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const from = structuredClone(state);
    from.emergencyFund = state.emergencyFund + 0.01;
    const digest = buildSaveEmailDigest(from, state);
    if (!digest) {
      setBusy(false);
      setMsg('Test could not build a change digest.');
      return;
    }
    const r = await postNotifyRelay('', {
      subject: 'Household finances · test',
      pocketLeft: pocketLeftSoFar(state),
      digest,
    });
    const snap = await postSnapshotRelay(buildSnapshotForReminders(state));
    setBusy(false);
    setMsg(
      r.ok
        ? snap.ok
          ? 'Test email sent (full digest layout) and snapshot saved. Check inbox (and spam).'
          : `Email sent; snapshot failed: ${snap.error}`
        : r.error,
    );
  }, [state]);

  const relayUrl = resolveNotifyRelayUrl();

  const emailErr = (v: string, label: string) => {
    const t = v.trim();
    if (!t) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `${label} doesn’t look like a valid email.`;
    return null;
  };
  const husbandEmailErr = emailErr(cfg.husbandEmail, 'Husband email');
  const wifeEmailErr = emailErr(cfg.wifeEmail, 'Wife email');

  const session = typeof window !== 'undefined' ? readHouseholdSession() : null;
  const isOwner = session?.role === 'owner';
  const householdId = (session?.householdId ?? cfg.householdId).trim();

  const createCronKey = useCallback(async () => {
    if (!householdId) {
      pushToast({ type: 'error', message: 'Sign in to create a cron API key for your household.' });
      return;
    }
    setCronKeyBusy(true);
    setCronKeyReveal(null);
    const r = await createHouseholdBearerKey(householdId);
    setCronKeyBusy(false);
    if (!r.ok) {
      pushToast({ type: 'error', message: r.error });
      return;
    }
    const curl = buildReminderCronCurl(householdId, r.key);
    setCronKeyReveal({ key: r.key, curl });
    pushToast({
      type: 'success',
      message: 'Cron API key created — copy it now (shown once). Update your Dokploy schedule.',
    });
  }, [householdId]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ type: 'success', message: `${label} copied.` });
    } catch {
      pushToast({ type: 'error', message: `Could not copy ${label.toLowerCase()}.` });
    }
  }, []);

  const householdMode = readHouseholdMode();
  const husbandTrim = cfg.husbandEmail.trim();
  const wifeTrim = cfg.wifeEmail.trim();
  const notifyEmailsLocked =
    householdMode === 'couple'
      ? husbandTrim.includes('@') && wifeTrim.includes('@')
      : husbandTrim.includes('@') || wifeTrim.includes('@');

  return (
    <div
      data-tour="tour-tools-notify"
      className="max-w-3xl rounded-xl border-2 border-slate-200/90 bg-white p-5 text-slate-900 shadow-md shadow-slate-900/10 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg dark:shadow-black/25"
    >
      <h3 className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg">Email heads-up</h3>
      <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        After you save changes, the app can email a short summary (not your full workbook). Requests go to{' '}
        <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">{relayUrl}</code> on this site — you do not
        configure an API URL.
      </p>

      <div className="mt-6">
        <HouseholdAuthPanel
          key={authTick}
          onAuthChange={() => setAuthTick((n) => n + 1)}
          onNotifyConfigChanged={() => {
            const fresh = { ...readNotifyRelayConfig(), url: resolveNotifyRelayUrl() };
            persist(fresh);
          }}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-moss-border dark:bg-moss-surface/65 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-col gap-3 rounded-xl px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <label htmlFor="notify-relay-enabled" className="text-sm font-semibold text-sage-900 dark:text-moss-fg">
              Email summaries
            </label>
            <p className="mt-1 text-xs leading-snug text-sage-600 dark:text-moss-muted">
              Email only after real workbook changes (~60s debounce): bills marked, amounts, income, etc. Not while
              browsing. Daily 7am summary is separate.
            </p>
          </div>
          <div className="relative inline-flex h-8 w-[3.35rem] shrink-0 self-end sm:self-center">
            <input
              id="notify-relay-enabled"
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => persist({ ...cfg, enabled: e.target.checked })}
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-slate-300 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600 dark:bg-moss-border peer-checked:bg-teal-600 dark:peer-checked:bg-teal-600"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-slate-900/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.4rem] dark:ring-white/10"
            />
          </div>
        </div>
        <p className="border-t border-slate-200/80 px-4 py-2.5 text-[11px] leading-snug text-sage-600 dark:border-moss-border dark:text-moss-muted sm:px-5">
          <strong className="text-sage-900 dark:text-moss-fg">Server storage</strong> uses your account session on this site.
          Recipient emails from setup are used for scheduled reminder mail. Use{' '}
          <strong className="text-sage-900 dark:text-moss-fg">Partner access</strong> above to invite your partner.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {notifyEmailsLocked && !editingRecipients ? (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 dark:border-moss-border dark:bg-moss-surface/80">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm text-slate-800 dark:text-moss-subtle">
                <span className="text-xs font-bold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                  Summary recipients
                </span>
                <span className="mt-1 block break-words">
                  {householdMode === 'couple' ? (
                    <>
                      {husbandTrim}
                      <span className="text-sage-500 dark:text-moss-muted"> · </span>
                      {wifeTrim}
                    </>
                  ) : (
                    husbandTrim || wifeTrim
                  )}
                </span>
              </p>
              <button
                type="button"
                className="btn-secondary btn-secondary-sm shrink-0 font-bold"
                onClick={() => setEditingRecipients(true)}
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {editingRecipients || !husbandTrim.includes('@') ? (
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted"
                  htmlFor="notify-email-h"
                >
                  {householdMode === 'single' ? 'Your email (recipient)' : 'Husband email (recipient)'}
                </label>
                <input
                  id="notify-email-h"
                  aria-invalid={Boolean(husbandEmailErr)}
                  aria-describedby={husbandEmailErr ? fieldErrorId('notify-h-email') : undefined}
                  className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                  placeholder="husband@example.com"
                  value={cfg.husbandEmail}
                  onChange={(e) => persist({ ...cfg, husbandEmail: e.target.value })}
                  autoComplete="email"
                  inputMode="email"
                />
                <FieldError id={fieldErrorId('notify-h-email')} message={husbandEmailErr} />
              </div>
            ) : null}
            {householdMode === 'couple' && (editingRecipients || !wifeTrim.includes('@')) ? (
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted"
                  htmlFor="notify-email-w"
                >
                  Wife email (recipient)
                </label>
                <input
                  id="notify-email-w"
                  aria-invalid={Boolean(wifeEmailErr)}
                  aria-describedby={wifeEmailErr ? fieldErrorId('notify-w-email') : undefined}
                  className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                  placeholder="wife@example.com"
                  value={cfg.wifeEmail}
                  onChange={(e) => persist({ ...cfg, wifeEmail: e.target.value })}
                  autoComplete="email"
                  inputMode="email"
                />
                <FieldError id={fieldErrorId('notify-w-email')} message={wifeEmailErr} />
              </div>
            ) : null}
          </div>
        )}
        {editingRecipients ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary btn-primary-sm font-bold"
              disabled={Boolean(husbandEmailErr) || Boolean(wifeEmailErr)}
              onClick={() => setEditingRecipients(false)}
            >
              Done
            </button>
            <span className="text-xs text-sage-600 dark:text-moss-muted">
              Edits save automatically and sync for scheduled reminders.
            </span>
          </div>
        ) : null}
        {cfg.enabled && !cfg.husbandEmail.trim() && !cfg.wifeEmail.trim() ? (
          <div
            role="status"
            className="rounded-xl border border-amber-300/90 bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            Add at least one notification email so change summaries and reminders have a recipient.
          </div>
        ) : null}
        {onReloadFromServer ? (
          <div>
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  const r = await onReloadFromServer();
                  setMsg(r.ok ? `Reloaded from server (updated ${r.updatedAt}).` : r.error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Loading…' : 'Reload from server'}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-snug text-sage-600 dark:text-moss-muted">
        <strong className="text-sage-900 dark:text-moss-fg">Daily bill reminders</strong> are sent automatically by the
        server (no setup required). Enable summaries above for change heads-ups after edits (~60s debounce).
      </p>

      {isOwner && session?.token ? (
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-moss-border dark:bg-moss-surface/50">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-sage-900 dark:text-moss-fg"
            aria-expanded={cronAdvancedOpen}
            onClick={() => setCronAdvancedOpen((o) => !o)}
          >
            Self-hosted / advanced (Dokploy cron key)
            <span className="text-sage-500 dark:text-moss-muted">{cronAdvancedOpen ? '−' : '+'}</span>
          </button>
          {cronAdvancedOpen ? (
            <div className="border-t border-slate-200/80 px-4 py-3 dark:border-moss-border">
              <p className="text-xs leading-snug text-sage-600 dark:text-moss-muted">
                Hosted deployments use in-process scheduling. Only use this if you run your own server without{' '}
                <code className="rounded bg-sage-100 px-1 dark:bg-moss-bg">REMINDER_CRON_ENABLED</code>.
              </p>
          {householdId ? (
            <p className="mt-2 font-mono text-[11px] text-sage-700 dark:text-moss-subtle">
              Household id: {householdId}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={cronKeyBusy || !householdId}
              onClick={() => void createCronKey()}
            >
              {cronKeyBusy ? 'Creating…' : 'Create cron API key'}
            </button>
            {cronKeyReveal ? (
              <>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm font-bold"
                  onClick={() => void copyText(cronKeyReveal.key, 'API key')}
                >
                  Copy key
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm font-bold"
                  onClick={() => void copyText(cronKeyReveal.curl, 'Dokploy curl')}
                >
                  Copy Dokploy curl
                </button>
              </>
            ) : null}
          </div>
          {cronKeyReveal ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                Save this key in Dokploy now — it will not be shown again.
              </p>
              <textarea
                readOnly
                rows={5}
                className="w-full rounded-lg border border-sage-300 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={cronKeyReveal.curl}
                aria-label="Dokploy reminder curl command"
              />
            </div>
          ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-secondary-sm font-bold" disabled={busy} onClick={testSend}>
          {busy ? 'Sending…' : 'Send test email'}
        </button>
        <a
          className="btn-secondary btn-secondary-sm font-bold"
          href="/preview/email?kind=change"
          target="_blank"
          rel="noreferrer"
        >
          Preview template
        </a>
      </div>

      {msg ? (
        <p className="mt-3 text-sm font-medium text-sage-800 dark:text-moss-subtle" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
