import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthActionEmail,
  buildPasswordChangedEmail,
  renderEmailHtml,
  renderEmailText,
} from '../templates.mjs';

describe('buildAuthActionEmail', () => {
  it('verify template includes branded subject and CTA', () => {
    const tpl = buildAuthActionEmail({
      kind: 'verify',
      actionLink: 'https://finance.solofi.cloud/#verify=abc123',
    });
    assert.match(tpl.subject, /Household finances/);
    assert.equal(tpl.title, 'Verify your email');
    assert.ok(tpl.primaryCta?.href?.includes('#verify='));
    assert.equal(tpl.primaryCta?.label, 'Verify email');
    assert.ok(tpl.sections.length >= 2);
  });

  it('renderEmailHtml includes CTA button for verify', () => {
    const tpl = buildAuthActionEmail({
      kind: 'verify',
      actionLink: 'https://finance.solofi.cloud/#verify=abc123',
    });
    const html = renderEmailHtml({
      title: tpl.title,
      preheader: tpl.preheader,
      sections: tpl.sections,
      footerHint: tpl.footerHint,
      primaryCta: tpl.primaryCta,
    });
    assert.match(html, /Verify email/);
    assert.match(html, /Household finances/);
    assert.match(html, /#verify=abc123/);
  });

  it('partner_join template includes invite CTA and pairing code', () => {
    const tpl = buildAuthActionEmail({
      kind: 'partner_join',
      actionLink: 'https://finance.solofi.cloud/#invite=xyz',
      inviteLink: 'https://finance.solofi.cloud/#invite=xyz',
      pairingCode: '262418',
    });
    assert.match(tpl.subject, /join/i);
    assert.equal(tpl.primaryCta?.label, 'Open invite link');
    assert.ok(tpl.sections.some((s) => s.items?.some((it) => (it.body ?? '').includes('262418'))));
  });

  it('partner_verify template includes verify CTA and invite link copy', () => {
    const tpl = buildAuthActionEmail({
      kind: 'partner_verify',
      actionLink: 'https://finance.solofi.cloud/#verify=abc',
      inviteLink: 'https://finance.solofi.cloud/#invite=xyz',
    });
    assert.match(tpl.subject, /partner invite/i);
    assert.equal(tpl.primaryCta?.label, 'Verify my email');
    assert.ok(tpl.sections.some((s) => s.items?.some((it) => (it.meta ?? '').includes('#invite=xyz'))));
  });

  it('renderEmailText includes link line', () => {
    const tpl = buildAuthActionEmail({
      kind: 'verify',
      actionLink: 'https://finance.solofi.cloud/#verify=abc123',
    });
    const text = renderEmailText({
      title: tpl.title,
      preheader: tpl.preheader,
      sections: tpl.sections,
      footerHint: tpl.footerHint,
      primaryCta: tpl.primaryCta,
    });
    assert.match(text, /Verify email: https:\/\/finance\.solofi\.cloud/);
  });
});

describe('buildPasswordChangedEmail', () => {
  it('includes branded subject and security copy', () => {
    const tpl = buildPasswordChangedEmail({ appBase: 'https://finance.solofi.cloud' });
    assert.match(tpl.subject, /password changed/i);
    assert.equal(tpl.title, 'Your password was changed');
    assert.ok(tpl.sections.some((s) => s.items?.some((it) => /Password updated/i.test(it.title ?? ''))));
    assert.equal(tpl.primaryCta?.href, 'https://finance.solofi.cloud');
  });

  it('renderEmailText mentions sign-in', () => {
    const tpl = buildPasswordChangedEmail({ appBase: 'https://finance.solofi.cloud' });
    const text = renderEmailText({
      title: tpl.title,
      preheader: tpl.preheader,
      sections: tpl.sections,
      footerHint: tpl.footerHint,
      primaryCta: tpl.primaryCta,
    });
    assert.match(text, /password/i);
    assert.match(text, /finance\.solofi\.cloud/);
  });
});
