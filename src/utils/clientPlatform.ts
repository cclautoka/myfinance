import { Capacitor } from '@capacitor/core';

export type ClientPlatform = 'web' | 'ios' | 'android';

/** Platform label for API audit headers and attribution. */
export function getClientPlatform(): ClientPlatform {
  if (!Capacitor.isNativePlatform()) return 'web';
  const p = Capacitor.getPlatform();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  return 'web';
}

export function clientPlatformLabel(p: ClientPlatform): string {
  if (p === 'ios') return 'iPhone / iPad';
  if (p === 'android') return 'Android';
  return 'Browser';
}

export function householdRoleLabel(role: string | undefined): string {
  if (role === 'partner') return 'Partner';
  if (role === 'owner') return 'Primary';
  return role ?? 'Member';
}
