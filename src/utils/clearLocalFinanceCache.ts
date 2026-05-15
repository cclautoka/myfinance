import { SERVER_CACHE_KEY } from '../data/storage';
import { STORAGE_KEY } from '../types/finance';
import { HOUSEHOLD_SETUP_STORAGE_KEY } from '../setup/constants';

/** Drop browser finance data before binding a new authenticated session. */
export function clearLocalFinanceCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SERVER_CACHE_KEY);
    localStorage.removeItem(HOUSEHOLD_SETUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
