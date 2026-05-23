import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushToken, unregisterPushToken } from '../utils/pushDeviceApi';
import { readStoredPushToken, writeStoredPushToken } from '../utils/pushTokenStorage';

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

/** Foreground notification tap — open dashboard when user taps a bill reminder. */
export function bindPushNotificationHandlers(onOpenApp: () => void): () => void {
  if (!isNativePushAvailable()) return () => {};

  const handles: { remove: () => Promise<void> }[] = [];

  void PushNotifications.addListener('pushNotificationActionPerformed', () => {
    onOpenApp();
  }).then((h) => handles.push(h));

  return () => {
    for (const h of handles) void h.remove();
  };
}
