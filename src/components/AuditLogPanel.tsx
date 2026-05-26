import { useCallback, useEffect, useState } from 'react';
import type { DigestListItem, DigestSection } from '../utils/financeStateDiff';
import { fetchAuditLog, type AuditLogEntry } from '../utils/auditApi';
import {
  auditChangeItems,
  auditHeadline,
  auditPreviewLines,
  auditSectionsForDisplay,
} from '../utils/auditDisplay';
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

function ChangeDetails({ sections }: { sections: DigestSection[] }) {
  if (!sections.length) return null;

  return (
    <ul className="mt-3 space-y-3 border-l-2 border-teal-500/40 pl-3 dark:border-teal-600/50">
      {sections.map((sec, i) => (
        <li key={i}>
          {sec.heading !== 'What changed' ? (
            <p className="text-xs font-bold uppercase tracking-wide text-sage-600 dark:text-moss-muted">{sec.heading}</p>
          ) : null}
          {sec.body ? (
            <p className="mt-0.5 text-sm text-sage-800 dark:text-moss-subtle">{sec.body}</p>
          ) : null}
          {sec.items?.length ? (
            <ul className="mt-2 space-y-2">
              {sec.items.map((item: DigestListItem, j: number) => (
                <li
                  key={j}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/60"
                >
                  <p className="text-sm font-semibold text-sage-900 dark:text-moss-fg">{item.title}</p>
                  {item.body ? <p className="mt-0.5 text-sm text-sage-800 dark:text-moss-subtle">{item.body}</p> : null}
                  {item.meta ? (
                    <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">{item.meta}</p>
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
        <h3 className="font-display text-base font-bold text-sage-900 dark:text-moss-fg">Activity log</h3>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
          A plain-language history of saves to your household workbook: who changed what, from web or the phone app, and
          when. Marking a bill handled, editing amounts, or logging a paycheque each create a row after sync.
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
        <p className="text-sm text-sage-600 dark:text-moss-muted">Loading activity…</p>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300/80 bg-white px-4 py-8 text-center text-sm text-sage-600 dark:border-moss-border dark:bg-moss-surface dark:text-moss-muted">
          No activity yet. Edits synced to the server will show here.
        </p>
      ) : null}

      <ul className="space-y-3">
        {entries.map((e) => {
          const expanded = expandedId === e.id;
          const platform = clientPlatformLabel(
            e.clientPlatform === 'ios' || e.clientPlatform === 'android' ? e.clientPlatform : 'web',
          );
          const headline = auditHeadline(e);
          const previews = expanded ? [] : auditPreviewLines(e);
          const detailSections = auditSectionsForDisplay(e);
          const changeCount = auditChangeItems(e).length;

          return (
            <li
              key={e.id}
              className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 dark:border-moss-border dark:bg-moss-surface"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sage-900 dark:text-moss-fg">{headline}</p>
                  <p className="mt-1 text-xs font-medium text-sage-600 dark:text-moss-muted">
                    {formatWhen(e.createdAt)} · {householdRoleLabel(e.memberRole)}
                    {e.memberEmail ? ` · ${e.memberEmail}` : ''} · {platform}
                  </p>
                  {!expanded && previews.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-sage-800 dark:text-moss-subtle">
                      {previews.map((line, idx) => (
                        <li key={idx} className="marker:text-teal-600 dark:marker:text-teal-400">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm shrink-0 font-bold"
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                >
                  {expanded ? 'Hide' : changeCount > 0 ? `Details (${changeCount})` : 'Details'}
                </button>
              </div>
              {expanded ? <ChangeDetails sections={detailSections} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
