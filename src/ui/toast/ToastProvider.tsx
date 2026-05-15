import { useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from './toastBus';
import { zLayers } from '../zLayers';

function toastShell(type: ToastItem['type']) {
  if (type === 'error') {
    return 'border-red-400/80 bg-red-50/95 text-red-950 shadow-lg shadow-red-900/10 dark:border-red-600/50 dark:bg-red-950/90 dark:text-red-50 dark:shadow-black/30';
  }
  return 'border-teal-400/70 bg-teal-50/95 text-sage-900 shadow-lg shadow-teal-900/10 dark:border-teal-700/50 dark:bg-teal-950/90 dark:text-teal-50 dark:shadow-black/30';
}

function dismissButtonClass(type: ToastItem['type']) {
  if (type === 'error') {
    return 'text-red-800 underline hover:text-red-900 dark:text-red-200 dark:hover:text-red-100';
  }
  return 'text-teal-800 underline hover:text-teal-900 dark:text-teal-200 dark:hover:text-teal-100';
}

function ToastCard({ item }: { item: ToastItem }) {
  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-sm ${toastShell(item.type)}`}
    >
      <p className="min-w-0 break-words">{item.message}</p>
      <button
        type="button"
        className={`shrink-0 text-xs font-bold ${dismissButtonClass(item.type)}`}
        onClick={() => dismissToast(item.id)}
      >
        Dismiss
      </button>
    </div>
  );
}

function ToastStack({ items }: { items: ToastItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:bottom-auto sm:top-0 sm:pb-0 sm:pt-[max(1rem,env(safe-area-inset-top,0px))]"
      style={{ zIndex: zLayers.toast }}
    >
      {items.map((item) => (
        <div key={item.id} className="w-full max-w-lg">
          <ToastCard item={item} />
        </div>
      ))}
    </div>
  );
}

export function ToastProvider() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return <ToastStack items={items} />;
}
