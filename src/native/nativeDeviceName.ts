import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

function cleanLabel(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Best-effort, human-friendly label for the current native device.
 * - iOS: usually the user’s device name (e.g. "Shahil’s iPhone")
 * - Android: manufacturer + model (e.g. "Google Pixel 8")
 */
export async function getNativeDeviceDisplayName(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;

  try {
    // Capacitor plugin API can vary slightly by platform/version; keep this best-effort and resilient.
    const anyDevice = Device as unknown as {
      getName?: () => Promise<{ name?: string }>;
      getInfo?: () => Promise<{ model?: string; manufacturer?: string }>;
    };

    const nameRes = anyDevice.getName ? await anyDevice.getName() : null;
    const explicitName = cleanLabel(String(nameRes?.name ?? ''));
    if (explicitName) return explicitName.slice(0, 80);

    const info = anyDevice.getInfo ? await anyDevice.getInfo() : null;

    const manufacturer = cleanLabel(String(info?.manufacturer ?? ''));
    const model = cleanLabel(String(info?.model ?? ''));
    const friendly = cleanLabel([manufacturer, model].filter(Boolean).join(' '));
    if (friendly) return friendly.slice(0, 80);
    if (model) return model.slice(0, 80);
  } catch {
    // ignore
  }

  return undefined;
}

