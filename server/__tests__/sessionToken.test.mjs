import test from 'node:test';
import assert from 'node:assert/strict';
import { signFinanceSession, verifyFinanceSession } from '../sessionToken.mjs';

test('session token round-trip', () => {
  const secret = 'x'.repeat(32);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tok = signFinanceSession({ sub: 'm1', hid: 'abc123', role: 'owner', exp }, secret);
  const v = verifyFinanceSession(tok, secret);
  assert.equal(v?.memberId, 'm1');
  assert.equal(v?.householdId, 'abc123');
  assert.equal(v?.role, 'owner');
});

test('session token rejects wrong secret', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tok = signFinanceSession({ sub: 'm1', hid: 'abc', role: 'owner', exp }, 'a'.repeat(32));
  assert.equal(verifyFinanceSession(tok, 'b'.repeat(32)), null);
});

test('session token rejects expired', () => {
  const secret = 'y'.repeat(32);
  const exp = Math.floor(Date.now() / 1000) - 10;
  const tok = signFinanceSession({ sub: 'm1', hid: 'abc', role: 'owner', exp }, secret);
  assert.equal(verifyFinanceSession(tok, secret), null);
});
