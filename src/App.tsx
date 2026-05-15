import { useEffect, useState, useSyncExternalStore } from 'react';
import { AuthenticatedFinanceApp } from './AuthenticatedFinanceApp';
import { PublicLandingShell } from './landing/PublicLandingShell';
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

  const [authBanner, setAuthBanner] = useState<string | null>(null);

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
        setAuthBanner('Email verified — welcome.');
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!cancelled) setAuthBanner(String((e as Error)?.message ?? e));
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
        setAuthBanner('Signed in via email link.');
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!cancelled) setAuthBanner(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!householdSignedIn) {
    return (
      <>
        {authBanner ? (
          <div className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-3">
            <div className="flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-teal-400/70 bg-teal-50/95 px-4 py-2 text-sm text-slate-900 shadow-lg dark:bg-teal-950/90 dark:text-teal-50">
              <p className="min-w-0 break-words">{authBanner}</p>
              <button type="button" className="shrink-0 text-xs font-bold underline" onClick={() => setAuthBanner(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <PublicLandingShell />
      </>
    );
  }

  return <AuthenticatedFinanceApp />;
}
