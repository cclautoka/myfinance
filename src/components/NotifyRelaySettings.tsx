import { useCallback, useState } from 'react';
import {
  ensureNotifyRelayHouseholdId,
  readNotifyRelayConfig,
  writeNotifyRelayConfig,
  type NotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import {
  buildFinanceChangeSummary,
  pocketLeftSoFar,
  postNotifyRelay,
  postSnapshotRelay,
  buildSnapshotForReminders,
} from '../utils/notifyRelay';
import type { FinanceState } from '../types/finance';

export function NotifyRelaySettings({ state }: { state: FinanceState }) {
  const [cfg, setCfg] = useState<NotifyRelayConfig>(() =>
    typeof window !== 'undefined'
      ? { ...readNotifyRelayConfig(), householdId: ensureNotifyRelayHouseholdId() }
      : { enabled: false, url: '', secret: '', husbandEmail: '', wifeEmail: '', householdId: '' },
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = useCallback((next: NotifyRelayConfig) => {
    setCfg(next);
    writeNotifyRelayConfig(next);
  }, []);

  const testSend = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const summary = `[Test]\n${buildFinanceChangeSummary(state)}`;
    const r = await postNotifyRelay(summary, {
      subject: 'Household finances · test',
      pocketLeft: pocketLeftSoFar(state),
    });
    const snap = await postSnapshotRelay(buildSnapshotForReminders(state));
    setBusy(false);
    setMsg(
      r.ok
        ? snap.ok
          ? 'Test email sent and snapshot saved. Check inbox (and spam).'
          : `Email sent; snapshot failed: ${snap.error}`
        : r.error,
    );
  }, [state]);

  return (
    <div className="max-w-3xl rounded-2xl border border-sage-200/90 bg-white/95 p-5 text-sage-900 shadow-sm dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg">
      <h3 className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg">Email heads-up (self-hosted)</h3>
      <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Deploy the small <strong className="text-sage-900 dark:text-moss-fg">notify API</strong> in this repo’s{' '}
        <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">server/</code> folder on your Dokploy server
        (Docker). Point this browser at its <code className="rounded bg-sage-100 px-1 py-0.5 text-xs dark:bg-moss-bg">POST /v1/notify</code>{' '}
        URL and the same secret you set in Dokploy env. After saves, the app sends a short summary (not your full workbook) so you get a
        mail nudge. Use HTTPS in production.
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-sage-800 dark:text-moss-subtle">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => persist({ ...cfg, enabled: e.target.checked })}
          className="rounded border-sage-400 text-teal-700 focus:ring-teal-600 dark:border-moss-border dark:bg-moss-surface"
        />
        Send email summaries after changes (debounced ~60s)
      </label>
      <p className="mt-2 text-xs leading-relaxed text-sage-700 dark:text-moss-muted">
        <strong className="text-sage-900 dark:text-moss-fg">Server storage</strong> uses the same shared secret and URL. When enabled,
        your workbook is saved to Postgres on the server (and still cached locally for offline).
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
            Notify API URL
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            placeholder="/v1/notify (same host) or https://notify.yourdomain.com/v1/notify"
            value={cfg.url}
            onChange={(e) => persist({ ...cfg, url: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
            Household id (used for server storage & reminders)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="max-w-full flex-1 overflow-x-auto rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-xs text-sage-800 dark:border-moss-border dark:bg-moss-bg dark:text-moss-subtle">
              {cfg.householdId || '—'}
            </code>
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
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
              Husband email (recipient)
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              placeholder="husband@example.com"
              value={cfg.husbandEmail}
              onChange={(e) => persist({ ...cfg, husbandEmail: e.target.value })}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
              Wife email (recipient)
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              placeholder="wife@example.com"
              value={cfg.wifeEmail}
              onChange={(e) => persist({ ...cfg, wifeEmail: e.target.value })}
              autoComplete="email"
              inputMode="email"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
            Shared secret (same as NOTIFY_API_SECRET on server)
          </label>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            placeholder="Long random string — never share publicly"
            value={cfg.secret}
            onChange={(e) => persist({ ...cfg, secret: e.target.value })}
            autoComplete="new-password"
          />
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
