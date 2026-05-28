import { useEffect, useSyncExternalStore } from 'react';
import { PublicLandingShell } from './landing/PublicLandingShell';
import { SignedInWorkbook, preloadWorkbookModule } from './SignedInWorkbook';
import { ToastProvider } from './ui/toast/ToastProvider';
import { pushToast } from './ui/toast/toastBus';
import { bootstrapPublicApiConfig } from './utils/publicApiBootstrap';
import {
  parseMagicLoginTokenFromHash,
  parseVerifyTokenFromHash,
  postNotifyRelayPublicJson,
  setNotifyRelayHouseholdId,
  syncHouseholdIdFromSession,
} from './utils/notifyRelayConfig';
import { fetchAndApplyNotifyEmails } from './utils/applyNotifyEmails';
import { readHouseholdSession, subscribeHouseholdSessionChanged, writeHouseholdSession } from './utils/householdSession';
import { clearLocalFinanceCache } from './utils/clearLocalFinanceCache';
import { SetupWizardDevPage } from './dev/SetupWizardDevPage';

function isSetupWizardDevPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return path === '/dev/setup-wizard';
}

export default function App() {
  const householdSignedIn = useSyncExternalStore(
    subscribeHouseholdSessionChanged,
    () => Boolean(readHouseholdSession()?.token),
    () => false,
  );

  useEffect(() => {
    bootstrapPublicApiConfig();
  }, []);

  useEffect(() => {
    if (householdSignedIn) syncHouseholdIdFromSession();
  }, [householdSignedIn]);

  useEffect(() => {
    if (readHouseholdSession()?.token) {
      void preloadWorkbookModule();
    }
  }, [householdSignedIn]);

  useEffect(() => {
    const vt = parseVerifyTokenFromHash();
    if (!vt) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = (await postNotifyRelayPublicJson('/v1/household/auth/verify-email', { token: vt })) as {
          token?: string;
          verified?: boolean;
          finishInviteWithPairingCode?: boolean;
          member?: { email?: string; role?: string; householdId?: string; emailVerified?: boolean };
        };
        if (cancelled) return;
        if (j.finishInviteWithPairingCode) {
          pushToast({
            type: 'success',
            message:
              'Email verified. Open your partner invite link again (from email), reload if needed, then enter the pairing code.',
          });
          try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            /* ignore */
          }
        } else if (j.token && j.member?.householdId) {
          clearLocalFinanceCache();
          setNotifyRelayHouseholdId(j.member.householdId);
          writeHouseholdSession({
            token: j.token,
            householdId: j.member.householdId,
            email: j.member.email,
            role: j.member.role,
            emailVerified: j.member.emailVerified ?? true,
          });
          void fetchAndApplyNotifyEmails();
          void preloadWorkbookModule();
          pushToast({ type: 'success', message: 'Email verified — welcome.' });
          try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            /* ignore */
          }
        } else if (j.verified) {
          pushToast({ type: 'success', message: 'Email verified.' });
          try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        if (!cancelled) {
          pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = parseMagicLoginTokenFromHash();
    if (!t) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = (await postNotifyRelayPublicJson('/v1/household/auth/consume-magic-login', { token: t })) as {
          token?: string;
          member?: { email?: string; role?: string; householdId?: string; emailVerified?: boolean };
        };
        if (cancelled) return;
        if (j.token && j.member?.householdId) {
          clearLocalFinanceCache();
          setNotifyRelayHouseholdId(j.member.householdId);
          writeHouseholdSession({
            token: j.token,
            householdId: j.member.householdId,
            email: j.member.email,
            role: j.member.role,
            emailVerified: j.member.emailVerified ?? true,
          });
          void fetchAndApplyNotifyEmails();
          void preloadWorkbookModule();
        }
        pushToast({ type: 'success', message: 'Signed in via email link.' });
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!cancelled) {
          pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Widget deep links (home/lock screen).
    // Examples:
    // - #widget=paylog → scroll to pay log
    // - #widget=bills → scroll to bills checklist (dashboard)
    const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const p = new URLSearchParams(h);
    const kind = (p.get('widget') ?? '').trim();
    if (!kind) return;
    const scrollTo = (id: string) => {
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    };
    if (kind === 'paylog') scrollTo('income-log-this-month');
    else if (kind === 'bills') scrollTo('bills-timeline');
    else if (kind === 'goals') scrollTo('savings-goals');
    else if (kind === 'income') scrollTo('household-income-spend');

    // Clear hash so it doesn't re-trigger on refresh.
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
  }, [householdSignedIn]);

  return (
    <>
      <ToastProvider />
      {isSetupWizardDevPreview() ? (
        <SetupWizardDevPage />
      ) : householdSignedIn ? (
        <SignedInWorkbook />
      ) : (
        <PublicLandingShell />
      )}
    </>
  );
}
