import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { FinanceState } from '../types/finance';
import {
  disableNativePush,
  enableNativePush,
  isNativePushAvailable,
  readStoredPushToken,
} from '../native/pushNotifications';
import {
  fetchPushDevices,
  fetchPushStatus,
  revokePushDevice,
  sendTestPush,
  type PushDeviceRow,
  type PushStatus,
} from '../utils/pushDeviceApi';
import { resolvePushNotificationPrefs } from '../utils/pushNotificationPrefs';
import { readHouseholdSession } from '../utils/householdSession';
import { pushToast } from '../ui/toast/toastBus';

function formatDeviceUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function platformLabel(p: 'ios' | 'android'): string {
  return p === 'ios' ? 'iPhone / iPad' : 'Android';
}

export function AppNotificationsPanel({
  state,
  onPatch,
}: {
  state: FinanceState;
  onPatch: (patch: Partial<FinanceState>) => void;
}) {
  const prefs = resolvePushNotificationPrefs(state);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [devices, setDevices] = useState<PushDeviceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [localToken, setLocalToken] = useState(() => readStoredPushToken());
  const native = isNativePushAvailable();
  const isOwner = readHouseholdSession()?.role === 'owner';

  const refresh = useCallback(async () => {
    const [s, d] = await Promise.all([fetchPushStatus(), fetchPushDevices()]);
    setStatus(s);
    setDevices(d);
    setLocalToken(readStoredPushToken());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const thisDeviceOn = Boolean(status?.deviceRegistered || localToken);

  const setBillReminders = (on: boolean) => {
    onPatch({
      pushNotificationPrefs: {
        ...prefs,
        billReminders: on,
      },
    });
    pushToast({
      type: 'success',
      message: on ? 'Bill reminder pushes enabled for the household.' : 'Bill reminder pushes paused.',
    });
  };

  const onEnableDevice = async () => {
    if (!native) return;
    setBusy(true);
    try {
      await enableNativePush();
      await refresh();
      pushToast({ type: 'success', message: 'This device is registered for alerts.' });
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const onDisableThisDevice = async () => {
    setBusy(true);
    try {
      await disableNativePush();
      await refresh();
      pushToast({ type: 'success', message: 'Alerts turned off on this device.' });
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      const r = await sendTestPush();
      pushToast({
        type: 'success',
        message: r.sent ? `Test sent to ${r.sent} device(s).` : 'Test sent.',
      });
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const onRevokeDevice = async (device: PushDeviceRow) => {
    if (!window.confirm(`Remove push access for ${device.memberEmail} on ${platformLabel(device.platform)}?`)) return;
    setBusy(true);
    try {
      await revokePushDevice(device.id);
      if (device.isThisDevice) await disableNativePush().catch(() => undefined);
      await refresh();
      pushToast({ type: 'success', message: 'Device removed from household alerts.' });
    } catch (e) {
      pushToast({ type: 'error', message: String((e as Error)?.message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-tour="tour-app-notifications"
      className="max-w-3xl rounded-xl border-2 border-teal-200/80 bg-white p-5 shadow-md shadow-teal-900/10 dark:border-teal-900/45 dark:bg-moss-elevated dark:shadow-black/25"
    >
      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-moss-fg">App notifications</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-moss-subtle">
        Manage push alerts for the household. Preferences sync with your workbook (same as bills and income). Email
        summaries are configured in <strong className="text-slate-900 dark:text-moss-fg">Email heads-up</strong> below.
      </p>

      {/* Household preferences */}
      <section className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/85 p-4 dark:border-moss-border dark:bg-moss-surface/60">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-moss-muted">Household alerts</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-moss-fg">Bill reminders (push)</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
              Overdue, due soon, and horizon bills — same content as the daily reminder email, delivered to every
              registered phone when the server supports push.
            </p>
          </div>
          <label className="relative inline-flex h-8 w-[3.35rem] shrink-0 cursor-pointer self-end sm:self-center">
            <input
              type="checkbox"
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              checked={prefs.billReminders}
              onChange={(e) => setBillReminders(e.target.checked)}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-slate-300 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600 dark:bg-moss-border peer-checked:bg-teal-600 dark:peer-checked:bg-teal-600"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-slate-900/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.4rem] dark:ring-white/10"
            />
          </label>
        </div>
        {status && !status.serverPushConfigured ? (
          <p className="mt-3 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            Server push is not configured yet (<code className="text-[11px]">FCM_SERVICE_ACCOUNT_*</code>). Devices can
            still register; alerts will deliver once Firebase is set up.
          </p>
        ) : null}
      </section>

      {/* This device */}
      <section className="mt-4 rounded-xl border border-teal-200/70 bg-teal-50/40 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800 dark:text-teal-300">This device</p>
        {native ? (
          <>
            <p className="mt-2 text-sm text-slate-700 dark:text-moss-subtle">
              {Capacitor.getPlatform() === 'ios' ? 'iPhone / iPad app' : 'Android app'} —{' '}
              <strong className={thisDeviceOn ? 'text-teal-800 dark:text-teal-300' : ''}>
                {thisDeviceOn ? 'Receiving alerts' : 'Not registered'}
              </strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!thisDeviceOn ? (
                <button type="button" className="btn-primary btn-primary-sm" disabled={busy} onClick={() => void onEnableDevice()}>
                  Enable on this device
                </button>
              ) : (
                <>
                  <button type="button" className="btn-secondary btn-secondary-sm" disabled={busy} onClick={() => void onTest()}>
                    Send test alert
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-sm"
                    disabled={busy}
                    onClick={() => void onDisableThisDevice()}
                  >
                    Turn off on this device
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-moss-muted">
            Install <strong className="text-slate-800 dark:text-moss-fg">Our Finance</strong> on your phone to register for
            push. You can still set household preferences here; they apply when a device is added.
          </p>
        )}
      </section>

      {/* Device list */}
      <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
            Household devices ({devices.length})
          </p>
          <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => void refresh()}>
            Refresh list
          </button>
        </div>
        {devices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-moss-muted">No phones registered yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-surface"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-moss-fg">
                    {platformLabel(d.platform)}
                    {d.isThisDevice ? (
                      <span className="ml-2 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:bg-teal-950/50 dark:text-teal-200">
                        This device
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-moss-muted">
                    {d.memberEmail}
                    {d.memberRole === 'owner' ? ' · Primary' : d.memberRole === 'partner' ? ' · Partner' : ''} ·{' '}
                    {formatDeviceUpdated(d.updatedAt)}
                  </p>
                </div>
                {(d.isMine || isOwner) && (
                  <button
                    type="button"
                    className="btn-ghost text-xs text-red-800 dark:text-red-300"
                    disabled={busy}
                    onClick={() => void onRevokeDevice(d)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-moss-muted">
          You can remove your own devices. The primary owner can remove any household device. Removing this device also
          clears local registration.
        </p>
      </section>
    </div>
  );
}
