import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { registerPushToken, unregisterPushToken } from '../utils/pushDeviceApi';
import { readStoredPushToken, writeStoredPushToken } from '../utils/pushTokenStorage';
import { pushToast } from '../ui/toast/toastBus';
import { getNativeDeviceDisplayName } from './nativeDeviceName';

const ANDROID_CHANNEL_ID = 'bill_reminders';

export { readStoredPushToken } from '../utils/pushTokenStorage';

export function isNativePushAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/** Android needs android/app/google-services.json or Firebase crashes on register(). */
export function isNativePushRegistrationReady(): boolean {
  if (!isNativePushAvailable()) return false;
  if (Capacitor.getPlatform() === 'android' && !__ANDROID_PUSH_READY__) return false;
  return true;
}

function nativePlatform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'android' ? 'android' : 'ios';
}

async function ensureAndroidPushChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await PushNotifications.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: 'Bill reminders',
    description: 'Overdue and upcoming bill alerts from Our Finance',
    importance: 5,
    vibration: true,
  });
}

async function obtainNativePushToken(): Promise<string> {
  let onReg: PluginListenerHandle | undefined;
  let onErr: PluginListenerHandle | undefined;

  try {
    return await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('Timed out waiting for a push token from Google Play services.')),
        30_000,
      );

      void (async () => {
        onReg = await PushNotifications.addListener('registration', (t) => {
          window.clearTimeout(timeout);
          if (t.value?.trim()) resolve(t.value.trim());
          else reject(new Error('Empty push token from device.'));
        });
        onErr = await PushNotifications.addListener('registrationError', (err) => {
          window.clearTimeout(timeout);
          reject(new Error(err.error || 'Push registration failed on this device.'));
        });
        try {
          await PushNotifications.register();
        } catch (e) {
          window.clearTimeout(timeout);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    });
  } finally {
    await onReg?.remove();
    await onErr?.remove();
  }
}

/** Request permission, register with OS, and upsert token on the server. */
export async function enableNativePush(): Promise<void> {
  if (!isNativePushAvailable()) {
    throw new Error('Push notifications are only available in the iOS and Android app.');
  }
  if (!isNativePushRegistrationReady()) {
    throw new Error(
      'Android push is not set up in this build (missing google-services.json). Add Firebase config under android/app/ and rebuild — see docs/capacitor.md.',
    );
  }

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'denied') {
    throw new Error('Notifications are blocked. Open Settings → Apps → Our Finance → Notifications and allow alerts.');
  }
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  await ensureAndroidPushChannel();

  const token = await obtainNativePushToken();

  try {
    const deviceName = await getNativeDeviceDisplayName();
    await registerPushToken(token, nativePlatform(), deviceName);
    writeStoredPushToken(token);
  } catch (e) {
    writeStoredPushToken('');
    try {
      await PushNotifications.unregister();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Remove token from server and OS registration. */
export async function disableNativePush(): Promise<void> {
  const stored = readStoredPushToken();
  try {
    await unregisterPushToken(stored || undefined);
  } finally {
    writeStoredPushToken('');
    if (isNativePushAvailable()) {
      try {
        await PushNotifications.unregister();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Foreground receive + tap — Android often hides tray banners while the app is open. */
export function bindPushNotificationHandlers(onOpenApp: () => void): () => void {
  if (!isNativePushAvailable()) return () => {};

  const handles: PluginListenerHandle[] = [];

  void PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const data = notification.data as Record<string, string> | undefined;
    if (data?.type === 'widgets_refresh') {
      window.dispatchEvent(new Event('finance-app-resume'));
      return;
    }
    const title = notification.title?.trim() || 'Our Finance';
    const body = notification.body?.trim() || 'You have a new alert.';
    pushToast({ type: 'success', message: `${title}: ${body}` });
  }).then((h) => handles.push(h));

  void PushNotifications.addListener('pushNotificationActionPerformed', () => {
    onOpenApp();
  }).then((h) => handles.push(h));

  return () => {
    for (const h of handles) void h.remove();
  };
}
