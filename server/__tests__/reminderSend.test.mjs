import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickReminderRecipientsAsync } from '../reminderSend.mjs';
import { notifyEmailsToRecipientList } from '../notifyEmails.mjs';

describe('notifyEmailsToRecipientList', () => {
  it('dedupes husband and wife emails', () => {
    const list = notifyEmailsToRecipientList({
      husbandEmail: 'a@example.com',
      wifeEmail: 'a@example.com',
    });
    assert.equal(list.length, 1);
    assert.equal(list[0], 'a@example.com');
  });

  it('returns both slots when distinct', () => {
    const list = notifyEmailsToRecipientList({
      husbandEmail: 'h@example.com',
      wifeEmail: 'w@example.com',
    });
    assert.deepEqual(list, ['h@example.com', 'w@example.com']);
  });
});

describe('pickReminderRecipientsAsync', () => {
  it('prefers body.to over snapshot', async () => {
    const to = await pickReminderRecipientsAsync(
      'abc',
      { to: ['override@example.com'] },
      { notifyRecipientEmails: ['snap@example.com'] },
    );
    assert.deepEqual(to, ['override@example.com']);
  });

  it('uses snapshot notifyRecipientEmails when body.to empty', async () => {
    const to = await pickReminderRecipientsAsync(
      'abc',
      {},
      { notifyRecipientEmails: ['snap@example.com', 'other@example.com'] },
    );
    assert.deepEqual(to, ['snap@example.com', 'other@example.com']);
  });
});
