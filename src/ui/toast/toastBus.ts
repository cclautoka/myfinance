export type ToastType = 'success' | 'error';

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

export type ToastInput = {
  type: ToastType;
  message: string;
};

type Listener = (toasts: ToastItem[]) => void;

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 4;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const fn of listeners) {
    fn(toasts);
  }
}

function scheduleDismiss(id: string) {
  const existing = dismissTimers.get(id);
  if (existing) clearTimeout(existing);
  dismissTimers.set(
    id,
    setTimeout(() => {
      dismissTimers.delete(id);
      dismissToast(id);
    }, AUTO_DISMISS_MS),
  );
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export function pushToast(input: ToastInput): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: ToastItem = {
    id,
    type: input.type,
    message: input.message.trim(),
    createdAt: Date.now(),
  };
  if (!item.message) return id;
  toasts = [item, ...toasts].slice(0, MAX_VISIBLE);
  emit();
  scheduleDismiss(id);
  return id;
}

export function dismissToast(id: string): void {
  const t = dismissTimers.get(id);
  if (t) {
    clearTimeout(t);
    dismissTimers.delete(id);
  }
  const next = toasts.filter((x) => x.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}
