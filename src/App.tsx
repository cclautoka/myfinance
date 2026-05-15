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
} from './utils/notifyRelayConfig';
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
