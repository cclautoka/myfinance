import crypto from 'crypto';

const escapeHtml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export function renderEmailHtml({
  title,
  preheader,
  sections,
  footerHint,
  primaryCta,
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

  const ctaHref = primaryCta?.href ? String(primaryCta.href) : '';
  const ctaLabel = primaryCta?.label ? String(primaryCta.label) : 'Open link';
  const ctaHtml =
    ctaHref.trim() &&
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 18px;">
  <tr>
    <td align="center">
      <a href="${escapeHtml(ctaHref)}" style="display: inline-block; padding: 14px 28px; border-radius: 14px; background: linear-gradient(135deg, #0D9488, #059669); color: #FFFFFF; font-weight: 900; font-size: 15px; text-decoration: none; letter-spacing: -0.01em;">${escapeHtml(ctaLabel)}</a>
    </td>
  </tr>
</table>`;

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
              ${ctaHtml || ''}
              <div style="margin-top: 18px; padding: 14px 14px; border-radius: 16px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #0F172A;">
                <div style="font-weight: 900;">Tip</div>
                <div style="margin-top: 6px; color:#334155; line-height: 1.55;">${escapeHtml(
                  footerHint ??
                    'This is a quick summary only. Your full workbook syncs to the household server — open the app on web or your phone for details. Color theme stays on each device.',
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

export function renderEmailText({ title, preheader, sections, footerHint, primaryCta }) {
  const lines = [];
  lines.push(`Household finances — ${title}`);
  if (preheader) lines.push(preheader);
  lines.push('');
  if (primaryCta?.href) {
    lines.push(`${primaryCta.label ?? 'Open link'}: ${primaryCta.href}`);
    lines.push('');
  }
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
  const title = 'Your workbook was updated';
  const preheader = `Changes saved for ${monthKey}. Planned income ${fmtMoney(planned)} · Pocket left ${fmtMoney(pocketLeft)}.`;
  const sections = Array.isArray(digest?.sections)
    ? digest.sections.map((s) => ({
        heading: String(s.heading ?? 'Changes').replace(/^What changed$/i, 'Changes in your workbook').slice(0, 120),
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
export function buildAuthActionEmail({ kind, actionLink, inviteLink, pairingCode }) {
  const safeLink = String(actionLink ?? '');
  const safeInviteLink = String(inviteLink ?? '');
  const safePairingCode = String(pairingCode ?? '').replace(/\D/g, '').slice(0, 6);
  const configs = {
    verify: {
      subject: 'Household finances · verify your email',
      title: 'Verify your email',
      preheader: 'Confirm this address to unlock your household workbook.',
      ctaLabel: 'Verify email',
      sections: [
        {
          heading: 'What to do',
          items: [
            {
              title: 'Confirm your address',
              body: 'Use the button below in the same browser where you open Household finances. Links expire after 24 hours.',
            },
          ],
        },
        {
          heading: 'Button not working?',
          items: [
            {
              title: 'Copy the full link',
              body: 'Paste it into your browser address bar if your mail app blocks buttons.',
              meta: safeLink.slice(0, 2000),
            },
          ],
        },
      ],
      footerHint:
        'After you verify, return to the app — your worksheet will sync automatically. If you did not create an account, ignore this message.',
    },
    reset: {
      subject: 'Household finances · reset your password',
      title: 'Reset your password',
      preheader: 'Choose a new password for your household account.',
      ctaLabel: 'Reset password',
      sections: [
        {
          heading: 'What to do',
          items: [
            {
              title: 'Set a new password',
              body: 'Open the secure link below. It expires after 24 hours and works once.',
            },
          ],
        },
        {
          heading: 'Button not working?',
          items: [{ title: 'Copy the full link', meta: safeLink.slice(0, 2000) }],
        },
      ],
      footerHint: 'If you did not request a reset, you can ignore this message.',
    },
    magic: {
      subject: 'Household finances · sign-in link',
      title: 'Sign in link',
      preheader: 'One-time link to open your household workbook on this device.',
      ctaLabel: 'Sign in',
      sections: [
        {
          heading: 'What to do',
          items: [
            {
              title: 'Open your workbook',
              body: 'This link signs you in once. Use the same browser you normally use for the app.',
            },
          ],
        },
        {
          heading: 'Button not working?',
          items: [{ title: 'Copy the full link', meta: safeLink.slice(0, 2000) }],
        },
      ],
      footerHint: 'If you did not request this link, ignore the message — it will expire on its own.',
    },
    partner_verify: {
      subject: 'Household finances · confirm your partner invite',
      title: 'Verify to join your household',
      preheader: 'Confirm your email, then open your invite link to enter the pairing code.',
      ctaLabel: 'Verify my email',
      sections: [
        {
          heading: 'Step 1 — Verify this address',
          items: [
            {
              title: 'Confirm your email',
              body: 'Click the button below. After you verify, reload your partner invite page (or use the invite link in step 2) and enter the pairing code your partner shared — that code does not expire either.',
            },
          ],
        },
        {
          heading: 'Step 2 — Open your invite link',
          items: [
            {
              title: 'Join with pairing code',
              body: 'After verifying, open this invite link in the same browser. Enter the 6-digit pairing code your partner shared with you.',
              meta: safeInviteLink.slice(0, 2000),
            },
          ],
        },
        {
          heading: 'Button not working?',
          items: [
            {
              title: 'Copy verify link',
              meta: safeLink.slice(0, 2000),
            },
          ],
        },
      ],
      footerHint:
        'Your partner invite link does not expire. If you did not expect this invitation, you can ignore this message.',
    },
    partner_join: {
      subject: 'Household finances · join your partner’s household',
      title: 'Join your household',
      preheader: 'Open your invite link and enter the pairing code your partner shared.',
      ctaLabel: 'Open invite link',
      sections: [
        {
          heading: 'What to do',
          items: [
            {
              title: 'Open the invite link',
              body: 'Use the button below (or copy the link). Enter your email on that page so we know it is you.',
            },
            ...(safePairingCode
              ? [
                  {
                    title: 'Enter the pairing code',
                    body: `When prompted, enter this 6-digit code: ${safePairingCode}. It does not expire.`,
                  },
                ]
              : [
                  {
                    title: 'Enter the pairing code',
                    body: 'Your partner will share a 6-digit pairing code with you. Enter it on the invite page to finish joining.',
                  },
                ]),
          ],
        },
        {
          heading: 'Button not working?',
          items: [{ title: 'Copy invite link', meta: safeInviteLink.slice(0, 2000) }],
        },
      ],
      footerHint:
        'This invite link does not expire. If you did not expect this message, you can ignore it.',
    },
  };
  const c = configs[kind] ?? configs.verify;
  return {
    subject: c.subject,
    title: c.title,
    preheader: c.preheader,
    sections: c.sections,
    footerHint: c.footerHint,
    primaryCta: safeLink.trim() ? { label: c.ctaLabel, href: safeLink } : undefined,
  };
}

/** Sent after a password reset completes (no action link). */
export function buildPasswordChangedEmail({ appBase }) {
  const base = String(appBase ?? '').trim().replace(/\/$/, '');
  const signInHint = base ? `Sign in at ${base}` : 'Sign in at your usual Household finances URL';
  return {
    subject: 'Household finances · password changed',
    title: 'Your password was changed',
    preheader: 'Your household account password was updated successfully.',
    sections: [
      {
        heading: 'What happened',
        items: [
          {
            title: 'Password updated',
            body: `Your sign-in password for Household finances was changed. ${signInHint} using your new password.`,
          },
        ],
      },
      {
        heading: 'Did not change your password?',
        items: [
          {
            title: 'Secure your account',
            body: 'Use “Forgot password” on the sign-in page to set a new password immediately. If you need help, contact your household owner.',
          },
        ],
      },
    ],
    footerHint: 'This is an automated security notice from Household finances.',
    primaryCta: base ? { label: 'Open Household finances', href: base } : undefined,
  };
}

