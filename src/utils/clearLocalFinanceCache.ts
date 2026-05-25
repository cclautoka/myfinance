import { SERVER_CACHE_KEY } from '../data/storage';
import { STORAGE_KEY } from '../types/finance';

/** Drop local workbook cache before binding a session — keeps setup-wizard completion (per household). */
export function clearLocalFinanceCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SERVER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
