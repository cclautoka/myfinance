import { readSnapshot } from './snapshots.mjs';
import { getDbEnabled, initDbIfNeeded, listMembersForHousehold, readState } from './db.mjs';
import { normalizeRecipientList } from './mail.mjs';

export function coupleNotifyEmailsFromOwnerSlot(ownerSlot, ownerEmail, partnerEmail) {
  const owner = String(ownerEmail ?? '').trim();
  const partner = String(partnerEmail ?? '').trim();
  const slot = ownerSlot === 'wife' ? 'wife' : 'husband';
  if (slot === 'wife') {
    return { husbandEmail: partner, wifeEmail: owner };
  }
  return { husbandEmail: owner, wifeEmail: partner };
}

/** Husband/wife slots from snapshot, else owner/partner member emails from Postgres. */
export async function resolveNotifyEmailsForHousehold(householdId) {
  const snap = await readSnapshot(householdId).catch(() => null);
  const data = snap?.data;
  if (data?.notifyEmails && typeof data.notifyEmails === 'object') {
    const he = String(data.notifyEmails.husbandEmail ?? '').trim();
    const we = String(data.notifyEmails.wifeEmail ?? '').trim();
    if (he || we) return { husbandEmail: he, wifeEmail: we };
  }
  const list = normalizeRecipientList(data?.notifyRecipientEmails);
  if (list.length >= 2) {
    return { husbandEmail: list[0], wifeEmail: list[1] };
  }
  if (list.length === 1) {
    return { husbandEmail: list[0], wifeEmail: '' };
  }
  if (!getDbEnabled()) return { husbandEmail: '', wifeEmail: '' };
  await initDbIfNeeded();
  const members = await listMembersForHousehold(householdId);
  const owner = members.find((m) => m.role === 'owner');
  const partner = members.find((m) => m.role === 'partner');
  if (owner?.email && partner?.email) {
    return { husbandEmail: owner.email.trim(), wifeEmail: partner.email.trim() };
  }
  if (owner?.email) return { husbandEmail: owner.email.trim(), wifeEmail: '' };
  return { husbandEmail: '', wifeEmail: '' };
}

export function notifyEmailsToRecipientList(notifyEmails) {
  const husbandEmail = String(notifyEmails?.husbandEmail ?? '').trim();
  const wifeEmail = String(notifyEmails?.wifeEmail ?? '').trim();
  return normalizeRecipientList([husbandEmail, wifeEmail].filter((e) => e.includes('@')));
}
