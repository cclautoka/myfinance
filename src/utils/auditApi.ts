import type { DigestSection } from './financeStateDiff';
import { getServerStorageConfig } from '../data/storage';
import { getClientPlatform } from './clientPlatform';
import { serverAuthBearer } from './serverAuth';

export type AuditLogEntry = {
  id: string;
  householdId: string;
  memberId: string | null;
  memberRole: string;
  memberEmail: string;
  clientPlatform: string;
  summary: string;
  changes: { sections?: DigestSection[]; truncated?: boolean };
  createdAt: string;
};

export async function fetchAuditLog(opts?: {
  limit?: number;
  before?: string;
  force?: boolean;
}): Promise<
  | { ok: true; entries: AuditLogEntry[] }
  | { ok: false; status: number; error: string }
> {
  const c = getServerStorageConfig({ force: opts?.force });
  if (!c.enabled) return { ok: false, status: 0, error: 'Server storage not configured' };

  const params = new URLSearchParams({ id: c.householdId });
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.before) params.set('before', opts.before);

  const url = `${c.baseUrl}/v1/audit?${params}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serverAuthBearer()}`,
      'X-Client-Platform': getClientPlatform(),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: t || res.statusText };
  }
  const j = (await res.json()) as { entries?: AuditLogEntry[] };
  return { ok: true, entries: j.entries ?? [] };
}
