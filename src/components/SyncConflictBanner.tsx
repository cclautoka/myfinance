export function SyncConflictBanner({
  onReloadFromServer,
  onKeepLocal,
}: {
  onReloadFromServer: () => void;
  onKeepLocal: () => void;
}) {
  return (
    <div
      role="status"
      className="border-b border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6"
    >
      <p>
        Another device saved newer changes. Reload to see them, or keep editing here — your next save will overwrite the
        server copy.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-primary-sm font-bold" onClick={onReloadFromServer}>
          Reload from server
        </button>
        <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={onKeepLocal}>
          Keep editing on this device
        </button>
      </div>
    </div>
  );
}
