import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushToken, unregisterPushToken } from '../utils/pushDeviceApi';
import { readStoredPushToken, writeStoredPushToken } from '../utils/pushTokenStorage';
import { pushToast } from '../ui/toast/toastBus';

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
    throw new Error('Notifications are blocked. Enable them in system Settings for Our Finance.');
  }
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  await ensureAndroidPushChannel();

  const token = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Timed out waiting for push token.')), 25_000);
    void (async () => {
      const onReg = await PushNotifications.addListener('registration', (t) => {
        window.clearTimeout(timeout);
        void onReg.remove();
        void onErr.remove();
        if (t.value) resolve(t.value);
        else reject(new Error('Empty push token from device.'));
      });
      const onErr = await PushNotifications.addListener('registrationError', (err) => {
        window.clearTimeout(timeout);
        void onReg.remove();
        void onErr.remove();
        reject(new Error(err.error || 'Push registration failed.'));
      });
      await PushNotifications.register();
    })();
  });

  await registerPushToken(token, nativePlatform());
  writeStoredPushToken(token);
}

/** Remove token from server and OS registration. */
export async function disableNativePush(): Promise<void> {
  const stored = readStoredPushToken();
  try {
    await unregisterPushToken(stored || undefined);
  } finally {
    writeStoredPushToken('');
    if (isNativePushAvailable()) {
      await PushNotifications.unregister();
    }
  }
}

/** Foreground receive + tap — Android often hides tray banners while the app is open. */
export function bindPushNotificationHandlers(onOpenApp: () => void): () => void {
  if (!isNativePushAvailable()) return () => {};

  const handles: { remove: () => Promise<void> }[] = [];

  void PushNotifications.addListener('pushNotificationReceived', (notification) => {
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
