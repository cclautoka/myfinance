import { useCallback } from 'react';
import { pushToast, type ToastInput } from './toastBus';

export function useToast() {
  const success = useCallback((message: string) => {
    pushToast({ type: 'success', message });
  }, []);

  const error = useCallback((message: string) => {
    pushToast({ type: 'error', message });
  }, []);

  const push = useCallback((input: ToastInput) => {
    pushToast(input);
  }, []);

  return { success, error, push };
}
