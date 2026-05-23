import fs from 'node:fs';
import { listPushTokensForHousehold, upsertPushDeviceToken } from './db.mjs';

function pushBillRemindersEnabled(stateData) {
  const prefs = stateData?.pushNotificationPrefs;
  if (!prefs || typeof prefs !== 'object') return true;
  return prefs.billReminders !== false;
}

let messaging = null;
let initFailed = false;

function parseServiceAccount() {
  const raw = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const path = (process.env.FCM_SERVICE_ACCOUNT_PATH ?? '').trim();
  if (!path) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

async function getMessaging(log) {
  if (messaging) return messaging;
  if (initFailed) return null;
  const sa = parseServiceAccount();
  if (!sa) return null;
  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    messaging = admin.messaging();
    return messaging;
  } catch (e) {
    initFailed = true;
    log?.warn?.(e, 'FCM init failed — push delivery disabled');
    return null;
  }
}

/** True when server can send via Firebase Cloud Messaging. */
export function isPushDeliveryConfigured() {
  return Boolean((process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim() || (process.env.FCM_SERVICE_ACCOUNT_PATH ?? '').trim());
}

function reminderPushCopy({ counts, monthKey }) {
  const parts = [];
  if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`);
  if (counts.dueSoon > 0) parts.push(`${counts.dueSoon} due soon`);
  if (counts.horizon > 0) parts.push(`${counts.horizon} coming up`);
  const summary = parts.length ? parts.join(' · ') : 'Bills need attention';
  return {
    title: `Our Finance · ${monthKey}`,
    body: summary,
  };
}

/**
 * Send bill-reminder push to all registered devices for a household.
 * @returns {{ ok: true, skipped?: boolean, reason?: string, sent?: number, failed?: number } | { ok: false, error: string }}
 */
export async function sendBillReminderPush(householdId, { monthKey, counts }, log, stateData = null) {
  if (stateData && !pushBillRemindersEnabled(stateData)) {
    return { ok: true, skipped: true, reason: 'prefs_disabled' };
  }

  const tokens = await listPushTokensForHousehold(householdId);
  if (!tokens.length) {
    return { ok: true, skipped: true, reason: 'no_tokens' };
  }

  const msg = await getMessaging(log);
  if (!msg) {
    return { ok: true, skipped: true, reason: 'push_not_configured' };
  }

  const { title, body } = reminderPushCopy({ counts, monthKey });
  const registrationTokens = tokens.map((t) => t.token);
  let sent = 0;
  let failed = 0;

  const chunkSize = 500;
  for (let i = 0; i < registrationTokens.length; i += chunkSize) {
    const slice = registrationTokens.slice(i, i + chunkSize);
    try {
      const res = await msg.sendEachForMulticast({
        tokens: slice,
        notification: { title, body },
        data: {
          type: 'bill_reminder',
          householdId: householdId.slice(0, 64),
          monthKey: String(monthKey ?? ''),
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
        android: {
          priority: 'high',
          notification: { channelId: 'bill_reminders', sound: 'default' },
        },
      });
      sent += res.successCount;
      failed += res.failureCount;
      for (const err of res.responses) {
        if (err.success) continue;
        const code = err.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          log?.info?.({ code }, 'FCM stale token (consider pruning)');
        }
      }
    } catch (e) {
      log?.error?.(e, 'FCM multicast failed');
      return { ok: false, error: 'Failed to send push notifications' };
    }
  }

  return { ok: true, sent, failed, tokenCount: registrationTokens.length };
}

/** Test push to one member's devices only. */
export async function sendTestPushToMember(householdId, memberId, log, opts = {}) {
  const currentToken = String(opts.currentToken ?? '').trim();
  const platform = opts.platform === 'android' ? 'android' : opts.platform === 'ios' ? 'ios' : null;
  const memberKey = String(memberId);

  let tokens = (await listPushTokensForHousehold(householdId)).filter(
    (t) => String(t.member_id) === memberKey,
  );

  if (!tokens.length && currentToken.length >= 8) {
    const all = await listPushTokensForHousehold(householdId);
    const match = all.find((t) => t.token === currentToken);
    if (match) {
      tokens = [match];
    } else if (platform) {
      await upsertPushDeviceToken({
        householdId,
        memberId,
        platform,
        token: currentToken,
      });
      tokens = [{ token: currentToken, platform }];
    }
  }

  if (!tokens.length) {
    return {
      ok: false,
      error: 'No push token on the server for this account. Tap “Enable on this device” again, then retry.',
      code: 'NO_TOKENS',
    };
  }

  const msg = await getMessaging(log);
  if (!msg) {
    return { ok: false, error: 'Push delivery not configured on server (FCM_SERVICE_ACCOUNT_*).', code: 'NOT_CONFIGURED' };
  }

  try {
    const res = await msg.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: {
        title: 'Our Finance · test',
        body: 'Push notifications are working for this device.',
      },
      data: { type: 'test' },
    });
    if (res.successCount < 1) {
      const fcmErr = res.responses.find((r) => !r.success)?.error;
      const detail = fcmErr?.message || fcmErr?.code || 'FCM rejected the token';
      log?.warn?.({ detail, failed: res.failureCount }, 'test push had no successes');
      return {
        ok: false,
        error: `${detail}. Tap “Enable on this device” again, then retry.`,
        code: 'FCM_FAILED',
      };
    }
    return { ok: true, sent: res.successCount, failed: res.failureCount };
  } catch (e) {
    log?.error?.(e, 'test push failed');
    return { ok: false, error: e?.message || 'Failed to send test push' };
  }
}
