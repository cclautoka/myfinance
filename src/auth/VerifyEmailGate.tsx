import { useState } from 'react';
import { apiBaseFromNotifyUrl, readNotifyRelayConfig } from '../utils/notifyRelayConfig';
import { readHouseholdSession } from '../utils/householdSession';
import type { ThemePreference } from '../types/finance';
import { zLayers } from '../ui/zLayers';

export function VerifyEmailGate({
  theme,
  onTheme,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    const base = apiBaseFromNotifyUrl(readNotifyRelayConfig().url);
    const sess = readHouseholdSession();
    if (!base || !sess?.token) {
      setMsg('Cannot resend — ensure notify URL is set, then sign in again from #auth.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${base}/v1/household/auth/request-verify-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sess.token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      setMsg('Verification email sent.');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: zLayers.setupWizard }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-email-title"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 id="verify-email-title" className="font-display text-2xl font-bold text-slate-950 dark:text-moss-fg">
            Verify your email
          </h1>
          <div className="flex shrink-0 items-center gap-0.5 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-1 dark:border-moss-border dark:bg-moss-elevated">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTheme(t)}
                className={`rounded-xl px-2.5 py-1.5 text-[10px] font-semibold capitalize ${
                  theme === t ? 'btn-toggle-active' : 'btn-toggle-idle'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-moss-subtle">
          Open the verification link we emailed you. When you return to this app in the same browser, we will finish
          setup automatically. Use <strong className="text-slate-900 dark:text-moss-fg">Resend</strong> if the message
          expired.
        </p>
        {msg ? <p className="mt-4 text-sm font-semibold text-teal-900 dark:text-teal-200">{msg}</p> : null}
        <div className="mt-8">
          <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void resend()}>
            Resend verification email
          </button>
        </div>
      </div>
    </div>
  );
}
