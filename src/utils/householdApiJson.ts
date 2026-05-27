import { formatHouseholdApiError, householdApiFetch } from './householdApiFetch';
import { readHouseholdSession } from './householdSession';
import { readNotifyRelayConfig } from './notifyRelayConfig';

async function parseHouseholdApiResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const snippet = text.trim().slice(0, 80);
    if (snippet.startsWith('<!') || snippet.startsWith('<html')) {
      throw new Error('Server returned a web page instead of JSON. Redeploy the API or check the app API URL.');
    }
    throw new Error((j.error as string) || text || `HTTP ${res.status}`);
  }
  return j;
}

function sessionOrLegacySecretHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sess = readHouseholdSession();
  if (sess?.token) headers.Authorization = `Bearer ${sess.token}`;
  else {
    const secret = readNotifyRelayConfig().secret.trim();
    if (secret) headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

/** POST JSON to household API with session (or legacy notify secret) auth. */
export async function postHouseholdApiJson(
  path: string,
  body: Record<string, unknown>,
  opts?: { auth?: 'session' | 'session-or-secret' | false },
): Promise<Record<string, unknown>> {
  const auth = opts?.auth ?? false;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth === 'session') {
    const sess = readHouseholdSession();
    if (!sess?.token) throw new Error('Sign in first.');
    headers.Authorization = `Bearer ${sess.token}`;
  } else if (auth === 'session-or-secret') {
    Object.assign(headers, sessionOrLegacySecretHeaders() as Record<string, string>);
  }
  let res: Response;
  try {
    res = await householdApiFetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(formatHouseholdApiError(e, path));
  }
  return parseHouseholdApiResponse(res);
}

/** GET JSON from household API with session bearer. */
export async function getHouseholdApiJson(
  path: string,
  opts?: { auth?: 'session' | false },
): Promise<Record<string, unknown>> {
  const auth = opts?.auth ?? false;
  const headers: Record<string, string> = {};
  if (auth === 'session') {
    const sess = readHouseholdSession();
    if (!sess?.token) throw new Error('Sign in first.');
    headers.Authorization = `Bearer ${sess.token}`;
  }
  let res: Response;
  try {
    res = await householdApiFetch(path, { method: 'GET', headers });
  } catch (e) {
    throw new Error(formatHouseholdApiError(e, path));
  }
  return parseHouseholdApiResponse(res);
}
