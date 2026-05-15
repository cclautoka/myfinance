import crypto from 'crypto';

const escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const fmtMoney = (n) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export function renderEmailHtml({
  title,
  preheader,
  sections,
  footerHint,
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader ?? '');
  const renderBody = (body) => {
    const b = String(body ?? '');
    if (!b.trim()) return '';
    // Preserve newlines for change digests.
    if (b.includes('\n')) {
      return `<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12.5px; line-height: 1.55; color: #0F172A; background: #F8FAFC; border: 1px solid #E5E7EB; padding: 12px 12px; border-radius: 12px;">${escapeHtml(
        b,
      )}</pre>`;
    }
    return `<div style="color: #374151; line-height: 1.6;">${escapeHtml(b)}</div>`;
  };
  const sectionHtml = sections
    .map((s) => {
      const itemRows = Array.isArray(s.items) ? s.items : [];
      const hasItems = itemRows.length > 0;
      const items = itemRows
        .map(
          (it) => `<li style="margin: 0 0 10px 0; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 14px; background: #FFFFFF;">
  <div style="font-weight: 800; color: #0F172A;">${escapeHtml(it.title)}</div>
  ${it.body ? `<div style="color: #334155; margin-top: 4px; line-height: 1.55;">${escapeHtml(it.body)}</div>` : ''}
  ${it.meta ? `<div style="color: #64748B; font-size: 12px; margin-top: 4px;">${escapeHtml(it.meta)}</div>` : ''}
</li>`,
        )
        .join('');
      const inner = hasItems
        ? `<ul style="margin: 0; padding: 0; list-style: none;">${items}</ul>`
        : s.body
          ? renderBody(s.body)
          : `<div style="color: #64748B; font-size: 13px;">None right now.</div>`;
      return `
<div style="margin-top: 18px; padding: 16px 16px; border: 1px solid #E5E7EB; border-radius: 16px; background: #FFFFFF;">
  <div style="font-weight: 900; color: #0F172A; margin-bottom: 10px; font-size: 14px;">${escapeHtml(s.heading)}</div>
  ${inner}
</div>`;
    })
    .join('');

  // deterministic-ish id so some clients thread nicely
  const mid = crypto.createHash('sha1').update(`${title}-${Date.now()}`).digest('hex').slice(0, 10);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background:#F3F4F6;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${safePreheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding: 24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 50px rgba(15,23,42,0.18);">
          <tr>
            <td style="padding: 22px 22px; background: radial-gradient(1200px 220px at 20% 10%, rgba(20,184,166,0.35), rgba(15,23,42,0) 60%), linear-gradient(135deg, #064E3B, #0B1220); color: #E5E7EB;">
              <div style="font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 800; color: #A7F3D0;">
                Household finances
              </div>
              <div style="font-size: 24px; font-weight: 950; margin-top: 8px; color: #FFFFFF; letter-spacing: -0.02em;">${safeTitle}</div>
              <div style="font-size: 13.5px; margin-top: 8px; color: rgba(209,250,229,0.92); line-height: 1.55;">${safePreheader}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 18px; background: #F9FAFB;">
              ${sectionHtml}
              <div style="margin-top: 18px; padding: 14px 14px; border-radius: 16px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #0F172A;">
                <div style="font-weight: 900;">Tip</div>
                <div style="margin-top: 6px; color:#334155; line-height: 1.55;">${escapeHtml(
                  footerHint ??
                    'This email is a heads-up. The full workbook still lives in your browser. Open the app to see details.',
                )}</div>
              </div>
              <div style="margin-top: 14px; font-size: 12px; color: #6B7280;">
                Message id: ${mid} · If you weren’t expecting this, rotate your shared secret.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText({ title, preheader, sections, footerHint }) {
  const lines = [];
  lines.push(`Household finances — ${title}`);
  if (preheader) lines.push(preheader);
  lines.push('');
  for (const s of sections) {
    lines.push(`== ${s.heading} ==`);
    if (Array.isArray(s.items) && s.items.length > 0) {
      for (const it of s.items) {
        lines.push(`- ${it.title}`);
        if (it.body) lines.push(`  ${it.body}`);
        if (it.meta) lines.push(`  (${it.meta})`);
      }
    } else if (s.body) {
      lines.push(s.body);
    } else {
      lines.push('None right now.');
    }
    lines.push('');
  }
  lines.push(footerHint ?? 'Open the app to see details.');
  return lines.join('\n');
}

export function buildChangeEmailTemplate({ summaryText, pocketLeft, monthKey }) {
  const title = 'Update saved';
  const preheader = `Saved changes for ${monthKey}. Pocket left so far: ${fmtMoney(pocketLeft)}.`;
  return {
    subject: `Household finances · saved · ${monthKey}`,
    title,
    preheader,
    sections: [
      {
        heading: 'What changed (summary)',
        body: summaryText,
      },
    ],
  };
}

/** Structured save email from SPA digest (`version: 1`). */
export function buildSaveEmailTemplate(digest) {
  const monthKey =
    typeof digest?.monthKey === 'string' && digest.monthKey.trim() ? digest.monthKey.trim().slice(0, 16) : 'this month';
  const pocketLeft = Number.isFinite(Number(digest?.pocketLeft)) ? Number(digest.pocketLeft) : 0;
  const planned = Number.isFinite(Number(digest?.plannedIncomeCombined)) ? Number(digest.plannedIncomeCombined) : 0;
  const title = 'Update saved';
  const preheader = `Saved ${monthKey}. Planned income ${fmtMoney(planned)} · Pocket left ${fmtMoney(pocketLeft)}.`;
  const sections = Array.isArray(digest?.sections)
    ? digest.sections.map((s) => ({
        heading: String(s.heading ?? 'Details').slice(0, 120),
        body: typeof s.body === 'string' ? s.body.slice(0, 8000) : undefined,
        items: Array.isArray(s.items)
          ? s.items.slice(0, 40).map((it) => ({
              title: String(it.title ?? '').slice(0, 220),
              body: it.body != null ? String(it.body).slice(0, 500) : undefined,
              meta: it.meta != null ? String(it.meta).slice(0, 220) : undefined,
            }))
          : undefined,
      }))
    : [];
  return {
    subject: `Household finances · saved · ${monthKey}`,
    title,
    preheader,
    sections,
  };
}

export function buildReminderEmailTemplate({ monthKey, dueSoon = [], overdue = [], horizon = [] }) {
  const nO = overdue.length;
  const nS = dueSoon.length;
  const nH = horizon.length;
  const title = nO > 0 ? 'Overdue items' : nS > 0 ? 'Upcoming bills' : 'Bills on the horizon';
  const preheader =
    nO > 0
      ? `${nO} overdue · ${nS} due soon · ${nH} on horizon.`
      : nS > 0
        ? `${nS} bill(s) due soon or in grace · ${nH} further out (14d).`
        : `${nH} unpaid bill(s) due within the next 14 days.`;
  return {
    subject: `Household finances · reminders · ${monthKey}`,
    title,
    preheader,
    sections: [
      {
        heading: 'Due soon (includes grace window)',
        items: dueSoon.map((b) => ({
          title: `${b.name} — ${fmtMoney(b.amount)}`,
          body: `Due ${b.dueDate}`,
          meta: b.note ?? '',
        })),
      },
      {
        heading: 'Overdue',
        items: overdue.map((b) => ({
          title: `${b.name} — ${fmtMoney(b.amount)}`,
          body: b.dueToday ? `Due today (${b.dueDate})` : `Was due ${b.dueDate}`,
          meta: b.note ?? '',
        })),
      },
      {
        heading: 'On the horizon (next 14 days, unpaid)',
        items: horizon.map((b) => ({
          title: `${b.name} — ${fmtMoney(b.amount)}`,
          body: `Due ${b.dueDate}`,
          meta: b.note ?? '',
        })),
      },
    ],
  };
}

/** Branded transactional mail for verify / reset / magic (uses same shell as digest emails). */
export function buildAuthActionEmail({ kind, actionLink }) {
  const safeLink = String(actionLink ?? '');
  const titles = {
    verify: {
      subject: 'Verify your email',
      title: 'Verify your email',
      preheader: 'One tap to confirm this address for your household account.',
    },
    reset: {
      subject: 'Reset your password',
      title: 'Reset your password',
      preheader: 'Use the secure link below to choose a new password.',
    },
    magic: {
      subject: 'Sign in to your household',
      title: 'Sign in link',
      preheader: 'This one-time link signs you in on a new device or browser.',
    },
  };
  const t = titles[kind] ?? titles.verify;
  return {
    subject: t.subject,
    title: t.title,
    preheader: t.preheader,
    sections: [
      {
        heading: 'Your secure link',
        items: [
          {
            title: 'Open in browser',
            body: 'If the link does not open, copy the full URL into the same browser where you use the app.',
            meta: safeLink.slice(0, 2000),
          },
        ],
      },
    ],
    footerHint: 'If you did not request this, you can ignore this message. Links expire automatically.',
  };
}

