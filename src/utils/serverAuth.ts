import { readNotifyRelayConfig } from './notifyRelayConfig';
import { readHouseholdSession } from './householdSession';

/** Prefer signed-in session; otherwise the relay shared secret. */
export function serverAuthBearer(): string {
  const cfg = readNotifyRelayConfig();
  const sess = readHouseholdSession();
  if (sess?.token) return sess.token;
  return (cfg.secret ?? '').trim();
}
