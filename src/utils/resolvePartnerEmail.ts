import { readNotifyRelayConfig } from './notifyRelayConfig';

/** Partner notification email (not the signed-in owner) for couple households. */
export function resolvePartnerEmailForInvite(ownerEmail: string | undefined): string {
  const owner = (ownerEmail ?? '').trim().toLowerCase();
  const { husbandEmail, wifeEmail } = readNotifyRelayConfig();
  const he = husbandEmail.trim().toLowerCase();
  const we = wifeEmail.trim().toLowerCase();
  if (he && we) {
    if (owner && he === owner) return wifeEmail.trim();
    if (owner && we === owner) return husbandEmail.trim();
    return wifeEmail.trim() || husbandEmail.trim();
  }
  if (he && he !== owner) return husbandEmail.trim();
  if (we && we !== owner) return wifeEmail.trim();
  return '';
}
