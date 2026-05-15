import { useEffect, useSyncExternalStore } from 'react';
import { AuthenticatedFinanceApp } from './AuthenticatedFinanceApp';
import { PublicLandingShell } from './landing/PublicLandingShell';
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
    const vt = parseVerifyTokenFromHash();
    if (!vt) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = (await postNotifyRelayPublicJson('/v1/household/auth/verify-email', { token: vt })) as {
          token?: string;
          verified?: boolean;
          finishInviteWithPairingCode?: boolean;
          member?: { email?: string; role?: string; householdId?: string };
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
          });
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
          member?: { email?: string; role?: string; householdId?: string };
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
          });
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
      {householdSignedIn ? <AuthenticatedFinanceApp /> : <PublicLandingShell />}
    </>
  );
}
