import { useEffect, useState } from 'react';

export function WorkbookLoadScreen({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (error) return;
    const t = window.setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [error]);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-gradient-to-br from-teal-50/90 via-[#f4f7fb] to-slate-100 px-6 text-center dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg">
        <p className="text-sm font-semibold text-slate-800 dark:text-moss-fg">Could not load your workbook</p>
        <p className="max-w-sm text-xs text-slate-600 dark:text-moss-muted">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <button type="button" className="btn-primary btn-primary-sm font-bold" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary btn-secondary-sm font-bold"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-gradient-to-br from-teal-50/90 via-[#f4f7fb] to-slate-100 px-6 text-center dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg">
      <p className="text-sm font-medium text-slate-600 dark:text-moss-muted">Loading your workbook…</p>
      {slow ? (
        <p className="max-w-xs text-xs text-slate-500 dark:text-moss-muted">
          This is taking longer than usual — often a slow connection or a cached old version after an update.{' '}
          <button
            type="button"
            className="font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-200"
            onClick={() => window.location.reload()}
          >
            Refresh the page
          </button>
        </p>
      ) : null}
    </div>
  );
}
