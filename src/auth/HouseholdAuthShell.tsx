import { useEffect, useState } from 'react';
import { defaultFinanceState } from '../data/defaults';
import type { ThemePreference } from '../types/finance';
import { bootstrapPublicApiConfig } from '../utils/publicApiBootstrap';
import { zLayers } from '../ui/zLayers';
import { HouseholdAuthForm } from './HouseholdAuthForm';

export function HouseholdAuthShell({
  theme: themeProp,
  onTheme,
  onAuthed,
}: {
  theme?: ThemePreference;
  onTheme?: (t: ThemePreference) => void;
  onAuthed?: () => void;
}) {
  const [theme, setTheme] = useState<ThemePreference>(themeProp ?? defaultFinanceState().theme);
  const applyTheme = onTheme ?? setTheme;

  useEffect(() => {
    bootstrapPublicApiConfig();
  }, []);

  return (
    <div
      className="cap-safe-top fixed inset-0 overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: zLayers.setupWizard }}
      role="dialog"
      aria-modal="true"
    >
      <HouseholdAuthForm theme={themeProp ?? theme} onTheme={applyTheme} onAuthed={onAuthed} variant="standalone" />
    </div>
  );
}
