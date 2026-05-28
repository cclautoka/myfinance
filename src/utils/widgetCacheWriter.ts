import type { FinanceState } from '../types/finance';
import { buildWidgetCacheV1 } from './widgetCache';
import { readHouseholdSession } from './householdSession';
import { requestWidgetRefreshNative, writeWidgetCacheNative } from '../native/widgetBridge';

const LOCAL_KEY = 'finance-widget-cache-v1';

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

  await writeWidgetCacheNative(json);
  await requestWidgetRefreshNative();
}

