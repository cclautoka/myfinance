import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthActionEmail, renderEmailHtml, renderEmailText } from '../templates.mjs';

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
