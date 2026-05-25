import { useCallback, useEffect, useState } from 'react';
import type { DigestListItem, DigestSection } from '../utils/financeStateDiff';
import { fetchAuditLog, type AuditLogEntry } from '../utils/auditApi';
import { clientPlatformLabel, householdRoleLabel } from '../utils/clientPlatform';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function ChangeDetails({ changes }: { changes: AuditLogEntry['changes'] }) {
  const sections = changes?.sections ?? [];
  if (!sections.length) return null;

  return (
    <ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 dark:border-moss-border">
      {sections.map((sec: DigestSection, i: number) => (
        <li key={i}>
          <p className="text-xs font-bold uppercase tracking-wide text-sage-600 dark:text-moss-muted">{sec.heading}</p>
          {sec.body ? (
            <p className="mt-0.5 text-sm text-sage-800 dark:text-moss-subtle">{sec.body}</p>
          ) : null}
          {sec.items?.length ? (
            <ul className="mt-1 space-y-1">
              {sec.items.map((item: DigestListItem, j: number) => (
                <li key={j} className="text-sm text-sage-800 dark:text-moss-subtle">
                  <span className="font-semibold text-sage-900 dark:text-moss-fg">{item.title}</span>
                  {item.body ? <span className="text-sage-700 dark:text-moss-muted"> — {item.body}</span> : null}
                  {item.meta ? (
                    <span className="mt-0.5 block font-mono text-xs text-sage-600 dark:text-moss-muted">{item.meta}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetchAuditLog({ limit: 50, force: true });
    setLoading(false);
    if (!r.ok) {
      setError(r.error || 'Could not load audit log.');
      return;
    }
    setEntries(r.entries);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4" data-tour="tour-tools-audit">
      <div>
        <h3 className="font-display text-base font-bold text-sage-900 dark:text-moss-fg">Household audit log</h3>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
          Who saved changes, from which app, and what changed. New entries appear after each server sync from a signed-in
          member.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-800 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading && entries.length === 0 ? (
        <p className="text-sm text-sage-600 dark:text-moss-muted">Loading audit entries…</p>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300/80 bg-white px-4 py-8 text-center text-sm text-sage-600 dark:border-moss-border dark:bg-moss-surface dark:text-moss-muted">
          No audit entries yet. Edits synced to the server will show here.
        </p>
      ) : null}

      <ul className="space-y-3">
        {entries.map((e) => {
          const expanded = expandedId === e.id;
          const platform = clientPlatformLabel(
            e.clientPlatform === 'ios' || e.clientPlatform === 'android' ? e.clientPlatform : 'web',
          );
          return (
            <li
              key={e.id}
              className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 dark:border-moss-border dark:bg-moss-surface"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sage-900 dark:text-moss-fg">{e.summary || 'Workbook updated'}</p>
                  <p className="mt-1 text-xs font-medium text-sage-600 dark:text-moss-muted">
                    {formatWhen(e.createdAt)} · {householdRoleLabel(e.memberRole)}
                    {e.memberEmail ? ` · ${e.memberEmail}` : ''} · {platform}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm shrink-0 font-bold"
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                >
                  {expanded ? 'Hide' : 'Details'}
                </button>
              </div>
              {expanded ? <ChangeDetails changes={e.changes} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
