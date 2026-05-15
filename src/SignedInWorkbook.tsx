import { useEffect, useState, type ComponentType } from 'react';
import { WorkbookLoadScreen } from './components/WorkbookLoadScreen';

type WorkbookModule = { AuthenticatedFinanceApp: ComponentType };

let workbookImport: Promise<WorkbookModule> | null = null;

export function preloadWorkbookModule(): Promise<WorkbookModule> {
  if (!workbookImport) {
    workbookImport = import('./AuthenticatedFinanceApp');
  }
  return workbookImport;
}

export function SignedInWorkbook() {
  const [ready, setReady] = useState<{
    App: ComponentType;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(null);
    void preloadWorkbookModule()
      .then((mod) => {
        if (!cancelled) setReady({ App: mod.AuthenticatedFinanceApp });
      })
      .catch((e) => {
        if (!cancelled) {
          workbookImport = null;
          setError(String((e as Error)?.message ?? e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return <WorkbookLoadScreen error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (!ready) {
    return <WorkbookLoadScreen />;
  }
  const App = ready.App;
  return <App />;
}
