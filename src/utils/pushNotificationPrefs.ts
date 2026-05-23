import type { FinanceState, PushNotificationPrefs } from '../types/finance';

export function resolvePushNotificationPrefs(state: FinanceState): Required<PushNotificationPrefs> {
  return {
    billReminders: state.pushNotificationPrefs?.billReminders !== false,
  };
}

export function patchPushNotificationPrefs(
  state: FinanceState,
  patch: Partial<PushNotificationPrefs>,
): FinanceState {
  return {
    ...state,
    pushNotificationPrefs: {
      ...resolvePushNotificationPrefs(state),
      ...patch,
    },
  };
}

/** Server-side: read prefs from stored workbook JSON. */
export function pushBillRemindersEnabled(stateData: Record<string, unknown> | null | undefined): boolean {
  const prefs = stateData?.pushNotificationPrefs as PushNotificationPrefs | undefined;
  return prefs?.billReminders !== false;
}
