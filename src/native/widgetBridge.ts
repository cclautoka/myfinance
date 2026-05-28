import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

type WidgetBridgePlugin = {
  /** Persist widget cache in native shared storage (App Group / SharedPreferences). */
  writeCache: (opts: { json: string; householdId?: string; token?: string }) => Promise<void>;
  /** Request widgets to refresh (best-effort; OS may throttle). */
  requestRefresh: () => Promise<void>;
};

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export async function writeWidgetCacheNative(json: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.writeCache({ json });
  } catch {
    // Ignore — widgets are optional and native plugin may not be present in older builds.
  }
}

export async function requestWidgetRefreshNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.requestRefresh();
  } catch {
    /* ignore */
  }
}

