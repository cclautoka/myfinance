import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applySetupFromUrlHash,
  buildShareSetupLink,
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
  const [authTick, setAuthTick] = useState(0);
  const sessionHouseholdId = readHouseholdSession()?.householdId?.trim() ?? '';
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

  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    const hid = (sessionHouseholdId || cfg.householdId || '').trim();
    if (!hid) return '';
    return buildShareSetupLink({
      baseUrl: base,
      householdId: hid,
      husbandEmail: cfg.husbandEmail,
      wifeEmail: cfg.wifeEmail,
    });
  }, [cfg.householdId, cfg.husbandEmail, cfg.wifeEmail, sessionHouseholdId]);

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
        <HouseholdAuthPanel key={authTick} onAuthChange={() => setAuthTick((n) => n + 1)} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-moss-border dark:bg-moss-surface/65 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-col gap-3 rounded-xl px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <label htmlFor="notify-relay-enabled" className="text-sm font-semibold text-sage-900 dark:text-moss-fg">
              Email summaries
            </label>
            <p className="mt-1 text-xs leading-snug text-sage-600 dark:text-moss-muted">
              Short heads-up after saves (~60s debounce). Uses your sign-in session and recipient emails below.
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
          Recipient emails below are saved into the server snapshot for scheduled reminder mail.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {sessionHouseholdId && shareLink ? (
          <p className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-xs text-slate-700 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
            Invite a partner:{' '}
            <button
              type="button"
              className="font-bold text-teal-800 underline underline-offset-2 dark:text-teal-300"
              onClick={() => {
                void navigator.clipboard?.writeText(shareLink);
                setMsg('Partner setup link copied.');
              }}
            >
              Copy setup link
            </button>
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted" htmlFor="notify-email-h">
              Husband email (recipient)
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted" htmlFor="notify-email-w">
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
        </div>
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
