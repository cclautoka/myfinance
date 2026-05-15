import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applySetupFromUrlHash,
  buildShareSetupLink,
  ensureNotifyRelayHouseholdId,
  readNotifyRelayConfig,
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
import { FieldHelp } from './ui/FieldHelp';

export function NotifyRelaySettings({
  state,
  onReloadFromServer,
}: {
  state: FinanceState;
  onReloadFromServer?: () => Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }>;
}) {
  const [cfg, setCfg] = useState<NotifyRelayConfig>(() => {
    if (typeof window === 'undefined') {
      return { enabled: false, url: '', secret: '', husbandEmail: '', wifeEmail: '', householdId: '' };
    }
    const base = { ...readNotifyRelayConfig(), householdId: ensureNotifyRelayHouseholdId() };
    const prefill = applySetupFromUrlHash();
    return prefill ? { ...base, ...prefill } : base;
  });
  const [householdDraft, setHouseholdDraft] = useState(() => cfg.householdId);
  const [msg, setMsg] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return applySetupFromUrlHash()
      ? 'Setup link applied. Paste the shared secret, then load from server.'
      : null;
  });
  const [busy, setBusy] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const [householdIdErr, setHouseholdIdErr] = useState<string | null>(null);
  const stateRef = useRef(state);
  const snapshotPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Remove hash so you don’t re-apply on every refresh / accidentally share again.
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
    setCfg(next);
    writeNotifyRelayConfig(next);
    const url = next.url.trim();
    const sec = next.secret.trim();
    const hid = next.householdId.trim();
    if (!next.enabled || !url || !hid) return;
    const canAuth = Boolean(sec) || Boolean(readHouseholdSession()?.token);
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

  const urlErr = useMemo(() => {
    if (!cfg.enabled) return null;
    const u = cfg.url.trim();
    if (!u) return 'URL is required when email summaries are enabled.';
    if (u.startsWith('/')) return null;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return 'Use an https:// or http:// URL, or a path starting with /.';
      }
      return null;
    } catch {
      return 'Enter a valid URL (https://…) or same-origin path (e.g. /v1/notify).';
    }
  }, [cfg.enabled, cfg.url]);

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
    const notifyUrl = (cfg.url ?? '').trim();
    const hid = (cfg.householdId ?? '').trim();
    if (!notifyUrl || !hid) return '';
    return buildShareSetupLink({
      baseUrl: base,
      notifyUrl,
      householdId: hid,
      husbandEmail: cfg.husbandEmail,
      wifeEmail: cfg.wifeEmail,
    });
  }, [cfg.householdId, cfg.husbandEmail, cfg.url, cfg.wifeEmail]);

  return (
    <div
      data-tour="tour-tools-notify"
      className="max-w-3xl rounded-xl border-2 border-slate-200/90 bg-white p-5 text-slate-900 shadow-md shadow-slate-900/10 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg dark:shadow-black/25"
    >
      <h3 className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg">Email heads-up (self-hosted)</h3>
      <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Deploy the small <strong className="text-sage-900 dark:text-moss-fg">notify API</strong> in this repo’s{' '}
        <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">server/</code> folder on your Dokploy server
        (Docker). Point this browser at its <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">POST /v1/notify</code>{' '}
        URL and a shared secret, an <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">hk_</code> household key, or sign-in below. After saves, the app sends a short summary (not your full
        workbook) so you get a mail nudge. Use HTTPS in production.
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
              Short heads-up after saves (~60s debounce). Uses relay URL, session or secret, and recipient emails below.
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
          <strong className="text-sage-900 dark:text-moss-fg">Server storage</strong> uses the same shared secret or session and URL.
          Husband and wife emails below are included in the server snapshot so{' '}
          <strong className="text-sage-900 dark:text-moss-fg">scheduled reminder mail</strong> can reach you. Add at least one address — the server no longer relies on a global{' '}
          <code className="rounded bg-sage-100 px-1 text-[11px] dark:bg-moss-bg">NOTIFY_TO</code> env (optional legacy fallback only).
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label
              className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted"
              htmlFor="notify-relay-url"
            >
              Notify API URL
            </label>
            {shareLink ? (
              <button
                type="button"
                className="text-xs font-bold text-teal-800 underline underline-offset-2 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
                onClick={() => {
                  void navigator.clipboard?.writeText(shareLink);
                  setMsg('Share link copied (no secrets included).');
                }}
              >
                Copy setup link
              </button>
            ) : null}
          </div>
          <FieldHelp label="Notify URL">
            Same origin path or full HTTPS URL to your deployed notify endpoint’s <code className="text-[11px]">POST /v1/notify</code>.
          </FieldHelp>
          <input
            id="notify-relay-url"
            aria-invalid={Boolean(urlErr)}
            aria-describedby={urlErr ? fieldErrorId('notify-url') : undefined}
            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            placeholder="/v1/notify (same host) or https://notify.yourdomain.com/v1/notify"
            value={cfg.url}
            onChange={(e) => persist({ ...cfg, url: e.target.value })}
            autoComplete="off"
          />
          <FieldError id={fieldErrorId('notify-url')} message={urlErr} />
          <p className="mt-1 text-[11px] leading-snug text-sage-600 dark:text-moss-muted">
            {shareLink ? (
              <>
                Setup link fills <strong>URL</strong> + <strong>household id</strong> only (never the secret).{' '}
                <span className="font-semibold">
                  Paste a global secret, an hk_ key, or sign in on the new device, then load from server.
                </span>
              </>
            ) : (
              <>Tip: enter URL + household id first to unlock the setup link.</>
            )}
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted" htmlFor="notify-household-id">
            Household id (used for server storage & reminders)
          </label>
          <FieldHelp label="Household id">
            16–64 character hex from your primary device. Required for server load/save and pairing with the same workbook.
          </FieldHelp>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="notify-household-id"
              aria-invalid={Boolean(householdIdErr)}
              aria-describedby={householdIdErr ? fieldErrorId('notify-household') : undefined}
              className="min-w-0 flex-1 rounded-lg border border-sage-300 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-sage-800 dark:border-moss-border dark:bg-moss-surface dark:text-moss-subtle"
              value={householdDraft}
              onChange={(e) => {
                setHouseholdDraft(e.target.value);
                setHouseholdIdErr(null);
              }}
              placeholder="Paste the shared household id"
              autoComplete="off"
              inputMode="text"
            />
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              onClick={() => {
                if (!cfg.householdId) return;
                void navigator.clipboard?.writeText(cfg.householdId);
                setMsg('Household id copied.');
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              onClick={() => {
                const next = householdDraft.trim();
                if (!/^[a-f0-9]{16,64}$/i.test(next)) {
                  setHouseholdIdErr('Household id should be hex (16–64 characters).');
                  return;
                }
                setHouseholdIdErr(null);
                persist({ ...cfg, householdId: next });
                setMsg('Household id saved on this device. Refresh to load server data.');
              }}
            >
              Use
            </button>
          </div>
          <FieldError id={fieldErrorId('notify-household')} message={householdIdErr} />
          <p className="mt-1 text-[11px] leading-snug text-sage-600 dark:text-moss-muted">
            To see the same data on another phone/laptop, paste the household id from your primary device and tap <strong>Use</strong>.
          </p>
        </div>
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
            Add at least one notification email so change summaries and reminders have a recipient (saved into the server snapshot
            after you type).
          </div>
        ) : null}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted" htmlFor="notify-secret">
            Shared secret or household key (hk_…)
          </label>
          <FieldHelp label="Auth">
            Optional when signed in here — otherwise paste your server <code className="text-[11px]">NOTIFY_API_SECRET</code> or an{' '}
            <code className="text-[11px]">hk_</code> key so “Load from server” can authenticate.
          </FieldHelp>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="notify-secret"
              type="password"
              className="min-w-0 flex-1 rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              placeholder="Long random string — never share publicly"
              value={cfg.secret}
              onChange={(e) => persist({ ...cfg, secret: e.target.value })}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={busy || !onReloadFromServer}
              onClick={async () => {
                if (!onReloadFromServer) return;
                setBusy(true);
                setMsg(null);
                try {
                  const r = await onReloadFromServer();
                  setMsg(r.ok ? `Loaded from server (updated ${r.updatedAt}).` : r.error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Loading…' : 'Load from server'}
            </button>
          </div>
        </div>
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
