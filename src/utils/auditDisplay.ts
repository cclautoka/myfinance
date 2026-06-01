import type { DigestListItem, DigestSection } from './financeStateDiff';
import type { AuditLogEntry } from './auditApi';

function formatPeriodKey(key: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return key;
}

/** Make older audit rows (raw ids / vague titles) easier to read in the UI. */
export function humanizeAuditItem(item: DigestListItem): DigestListItem {
  let { title, body, meta } = item;

  if (title === 'Bill checkmarks' && body) {
    const m = body.match(/^([^:]+):\s*paid keys changed$/i);
    if (m) {
      title = 'Bill handled status';
      body = m[1].trim();
    }
  }

  if (meta && /→/.test(meta)) {
    const parts = meta.split('→').map((s) => s.trim());
    const human = parts
      .map((p) => {
        if (p === '—') return p;
        return p
          .split(',')
          .map((k) => formatPeriodKey(k.trim()))
          .join(', ');
      })
      .join(' → ');
    meta = human;
  }

  if (body && /^\d{4}-\d{2}/.test(body.split('·').pop()?.trim() ?? '')) {
    const bits = body.split('·').map((s) => s.trim());
    if (bits.length >= 2) {
      const period = formatPeriodKey(bits[bits.length - 1]);
      body = `${bits.slice(0, -1).join(' · ')} · ${period}`;
    }
  }

  return { title, body, meta };
}

export function auditChangeItems(entry: AuditLogEntry): DigestListItem[] {
  const sections = entry.changes?.sections ?? [];
  const items: DigestListItem[] = [];
  for (const sec of sections) {
    if (sec.heading !== 'What changed') continue;
    if (sec.body && !sec.items?.length) {
      items.push({
        title: 'Summary',
        body: sec.body.replace(/field-level detail omitted/i, 'see Details for line items when available'),
      });
      continue;
    }
    for (const it of sec.items ?? []) {
      items.push(humanizeAuditItem(it));
    }
  }
  return items;
}

/** Primary headline for an audit row (prefers stored summary, falls back to parsed changes). */
export function auditHeadline(entry: AuditLogEntry): string {
  const raw = (entry.summary ?? '').trim();
  if (raw && !/field-level detail omitted/i.test(raw)) return raw;

  const items = auditChangeItems(entry);
  if (items.length === 1) {
    const i = items[0];
    return [i.title, i.body].filter(Boolean).join(' — ');
  }
  if (items.length > 1) {
    const first = items[0];
    const line = [first.title, first.body].filter(Boolean).join(' — ');
    return `${items.length} changes — ${line}`;
  }

  if (/omitted/i.test(raw)) return 'Other workbook settings updated';
  return raw || 'Workbook saved';
}

/** Short bullets shown before expanding Details. */
export function auditPreviewLines(entry: AuditLogEntry, max = 3): string[] {
  const items = auditChangeItems(entry);
  const lines: string[] = [];
  for (const it of items) {
    if (lines.length >= max) break;
    const line = [it.title, it.body].filter(Boolean).join(' — ');
    if (it.meta) lines.push(`${line} (${it.meta})`);
    else if (line) lines.push(line);
  }
  if (items.length > max) lines.push(`+${items.length - max} more…`);
  return lines;
}

/** Friendlier lines for save-notification emails (and legacy digest rows). */
export function formatDigestItemForEmail(item: DigestListItem): DigestListItem {
  const h = humanizeAuditItem(item);
  const title = h.title;
  const body = h.body ?? '';
  const meta = h.meta ?? '';

  if (title === 'Marked as paid' && body) {
    return { title: `${body} marked as paid`, body: meta || undefined };
  }
  if (title === 'Unmarked as paid' && body) {
    return { title: `${body} unmarked as paid`, body: meta || undefined };
  }
  if (title === 'Actual paid amount') {
    if (meta) return { title: `Paid amount recorded for ${body}`, body: meta };
    return { title: `Paid amount for ${body}`, body: undefined };
  }
  if (title === 'Bill handled status' || title === 'Bill checkmarks') {
    return {
      title: body ? `Bill updates for ${body}` : 'Bill payment status changed',
      body: meta || undefined,
    };
  }
  if (meta && !body) return { title, body: meta };
  if (meta && body) return { title, body: `${body} (${meta})` };
  return h;
}

export function digestSectionsForEmail(sections: DigestSection[]): DigestSection[] {
  return sections.map((sec) => {
    if (sec.heading !== 'What changed' || !sec.items?.length) {
      return {
        ...sec,
        heading: sec.heading === 'What changed' ? 'Changes in your workbook' : sec.heading,
      };
    }
    return {
      heading: 'Changes in your workbook',
      body: sec.body,
      items: sec.items.map((it) => formatDigestItemForEmail(it)),
    };
  });
}

export function auditSectionsForDisplay(entry: AuditLogEntry): DigestSection[] {
  const sections = entry.changes?.sections ?? [];
  return sections.map((sec) => {
    if (sec.heading !== 'What changed' || !sec.items?.length) return sec;
    return {
      ...sec,
      items: sec.items.map(humanizeAuditItem),
      body: sec.body?.replace(/field-level detail omitted/i, 'Additional fields changed (see list below)'),
    };
  });
}
