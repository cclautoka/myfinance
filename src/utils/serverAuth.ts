import { ensureNotifyRelayHouseholdId, readNotifyRelayConfig } from './notifyRelayConfig';
import { readHouseholdSession } from './householdSession';

/** Prefer signed-in session for this household; otherwise the relay shared secret. */
export function serverAuthBearer(): string {
  const cfg = readNotifyRelayConfig();
  const hid = ensureNotifyRelayHouseholdId();
  const sess = readHouseholdSession();
  if (sess?.token && sess.householdId === hid) return sess.token;
  return (cfg.secret ?? '').trim();
}
