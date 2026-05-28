import type { FinanceState } from '../types/finance';
import { buildWidgetCacheV1 } from './widgetCache';
import { readHouseholdSession } from './householdSession';
import { requestWidgetRefreshNative } from '../native/widgetBridge';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

const LOCAL_KEY = 'finance-widget-cache-v1';

type WidgetBridgePlugin = {
  writeCache: (opts: { json: string; householdId?: string; token?: string }) => Promise<void>;
};
const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export async function writeWidgetCache(state: FinanceState): Promise<void> {
  const sess = readHouseholdSession();
  const payload = buildWidgetCacheV1(state, { householdId: sess?.householdId });
  const json = JSON.stringify(payload);

  // Fallback: allow debugging via web localStorage (not used by native widgets).
  try {
    localStorage.setItem(LOCAL_KEY, json);
  } catch {
    /* ignore */
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await WidgetBridge.writeCache({ json, householdId: sess?.householdId, token: sess?.token });
    } catch {
      /* ignore */
    }
  }
  await requestWidgetRefreshNative();
}

