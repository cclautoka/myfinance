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
    // Prefer explicit device name when supported (commonly iOS).
    const nameRes = await (Device as unknown as { getName?: () => Promise<{ name?: string }> }).getName?.();
    const explicitName = cleanLabel(String(nameRes?.name ?? ''));
    if (explicitName) return explicitName.slice(0, 80);

    // Fallback: manufacturer + model (Android).
    const info = await Device.getInfo();
    const manufacturer = cleanLabel(String(info.manufacturer ?? ''));
    const model = cleanLabel(String(info.model ?? ''));
    const friendly = cleanLabel([manufacturer, model].filter(Boolean).join(' '));
    if (friendly) return friendly.slice(0, 80);
    if (model) return model.slice(0, 80);
  } catch {
    // ignore
  }

  return undefined;
}

