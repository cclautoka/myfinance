import { useState } from 'react';
import { apiBaseFromNotifyUrl, readNotifyRelayConfig } from '../utils/notifyRelayConfig';
import { readHouseholdSession } from '../utils/householdSession';
import type { ThemePreference } from '../types/finance';
import { zLayers } from '../ui/zLayers';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import { THEME_SEGMENT_OPTIONS } from '../components/ui/themeSegmentedOptions';

export function VerifyEmailGate({
  theme,
  onTheme,
  email,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  email?: string;
  onVerified?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    const base = apiBaseFromNotifyUrl(readNotifyRelayConfig().url);
    const sess = readHouseholdSession();
    if (!base || !sess?.token) {
      setMsg('Cannot resend — sign in again, then use Resend.');
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
      let j: Record<string, unknown> = {};
      try {
        j = JSON.parse(text) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error((j.error as string) || text || `HTTP ${res.status}`);
      setMsg('Verification email sent — check your inbox (and spam).');
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const displayEmail = (email ?? readHouseholdSession()?.email ?? '').trim();

  const Root = 'div' as const;
  return (
    <Root
      className="fixed inset-0 flex flex-col overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: zLayers.setupWizard }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-email-title"
    >
      <Root className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:px-6">
        <Root className="flex items-start justify-between gap-3">
          <h1 id="verify-email-title" className="font-display text-2xl font-bold text-slate-950 dark:text-moss-fg">
            Verify your email
          </h1>
          <Root className="w-full max-w-[11.5rem] shrink-0 sm:max-w-[13rem]">
            <SegmentedButtonGroup
              aria-label="Color theme"
              value={theme}
              onChange={onTheme}
              options={THEME_SEGMENT_OPTIONS}
              size="compact"
            />
          </Root>
        </Root>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-moss-subtle">
          {displayEmail ? (
            <>
              We sent a link to <strong className="text-slate-900 dark:text-moss-fg">{displayEmail}</strong>. Open it in
              this browser to unlock your household workbook.
            </>
          ) : (
            <>Open the verification link we emailed you to unlock your household workbook.</>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-moss-muted">
          Email verification is required before your data can sync or save to the server.
        </p>
        {msg ? <p className="mt-4 text-sm font-semibold text-teal-900 dark:text-teal-200">{msg}</p> : null}
        <Root className="mt-8">
          <button type="button" className="btn-primary btn-primary-sm font-bold" disabled={busy} onClick={() => void resend()}>
            Resend verification email
          </button>
        </Root>
      </Root>
    </Root>
  );
}
