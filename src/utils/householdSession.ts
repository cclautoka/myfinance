const KEY = 'finance-household-session-v1';

const SESSION_CHANGED = 'finance-household-session-changed';

function emitSessionChanged() {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_CHANGED));
  } catch {
    /* ignore */
  }
}

/** Subscribe to {@link writeHouseholdSession} / {@link clearHouseholdSession} (same tab). */
export function subscribeHouseholdSessionChanged(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_CHANGED, cb);
  return () => window.removeEventListener(SESSION_CHANGED, cb);
}

export type HouseholdSession = {
  token: string;
  householdId: string;
  email?: string;
  role?: string;
  /** Cached from login / verify so the app does not block on /me when already verified. */
  emailVerified?: boolean;
};

export function readHouseholdSession(): HouseholdSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as HouseholdSession;
    if (!j?.token || !j?.householdId) return null;
    return j;
  } catch {
    return null;
  }
}

export function writeHouseholdSession(s: HouseholdSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    emitSessionChanged();
  } catch {
    /* ignore */
  }
}

export function clearHouseholdSession(): void {
  try {
    localStorage.removeItem(KEY);
    emitSessionChanged();
  } catch {
    /* ignore */
  }
}
