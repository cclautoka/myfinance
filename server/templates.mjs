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
  const sectionHtml = sections
    .map((s) => {
      const items = (s.items ?? [])
        .map(
          (it) => `<li style="margin: 0 0 8px 0;">
  <div style="font-weight: 700; color: #111827;">${escapeHtml(it.title)}</div>
  ${it.body ? `<div style="color: #374151; margin-top: 2px;">${escapeHtml(it.body)}</div>` : ''}
  ${it.meta ? `<div style="color: #6B7280; font-size: 12px; margin-top: 2px;">${escapeHtml(it.meta)}</div>` : ''}
</li>`,
        )
        .join('');
      return `
<div style="margin-top: 18px; padding: 16px 16px; border: 1px solid #E5E7EB; border-radius: 14px; background: #FFFFFF;">
  <div style="font-weight: 800; color: #0F172A; margin-bottom: 10px;">${escapeHtml(s.heading)}</div>
  ${
    items
      ? `<ul style="margin: 0; padding-left: 18px;">${items}</ul>`
      : `<div style="color: #374151;">${escapeHtml(s.body ?? '')}</div>`
  }
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
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; margin: 0 auto; background: #0B1220; border-radius: 18px; overflow: hidden;">
          <tr>
            <td style="padding: 18px 18px; background: linear-gradient(135deg, #064E3B, #0F172A); color: #E5E7EB;">
              <div style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: #A7F3D0;">
                Household finances
              </div>
              <div style="font-size: 22px; font-weight: 900; margin-top: 6px; color: #FFFFFF;">${safeTitle}</div>
              <div style="font-size: 13px; margin-top: 6px; color: #D1FAE5;">${safePreheader}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 18px; background: #F9FAFB;">
              ${sectionHtml}
              <div style="margin-top: 18px; padding: 14px 14px; border-radius: 14px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #1F2937;">
                <div style="font-weight: 800;">Tip</div>
                <div style="margin-top: 6px; color:#374151;">${escapeHtml(
                  footerHint ??
                    'This email is a heads-up. The full workbook still lives in your browser. Open the app to see details.',
                )}</div>
              </div>
              <div style="margin-top: 14px; font-size: 12px; color: #6B7280;">
                Message id: ${mid}
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
    if (s.items?.length) {
      for (const it of s.items) {
        lines.push(`- ${it.title}`);
        if (it.body) lines.push(`  ${it.body}`);
        if (it.meta) lines.push(`  (${it.meta})`);
      }
    } else if (s.body) {
      lines.push(s.body);
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

export function buildReminderEmailTemplate({ monthKey, dueSoon = [], overdue = [] }) {
  const title = overdue.length ? 'Overdue items' : 'Upcoming bills';
  const preheader = overdue.length
    ? `${overdue.length} overdue item(s) need attention.`
    : `${dueSoon.length} bill(s) coming up soon.`;
  return {
    subject: `Household finances · reminders · ${monthKey}`,
    title,
    preheader,
    sections: [
      {
        heading: 'Due soon',
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
          body: `Was due ${b.dueDate}`,
          meta: b.note ?? '',
        })),
      },
    ],
  };
}

