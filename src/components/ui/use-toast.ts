import { useState } from 'react';

export type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = (props: ToastProps) => {
    console.log('Toast:', props);
  };

  return {
    toast,
    toasts,
  };
}
