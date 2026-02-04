import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  timer?: any;
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

export function useToast() {
  const removeToast = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      const toast = toasts.value[index];
      if (toast.timer) clearTimeout(toast.timer);
      toasts.value.splice(index, 1);
    }
  };

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) => {
    const id = nextId++;
    const toast: Toast = { id, message, type, duration };
    toasts.value.push(toast);

    if (duration > 0) {
      toast.timer = setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const pauseToast = (id: number) => {
    const toast = toasts.value.find(t => t.id === id);
    if (toast && toast.timer) {
      clearTimeout(toast.timer);
      toast.timer = undefined;
    }
  };

  const resumeToast = (id: number) => {
    const toast = toasts.value.find(t => t.id === id);
    if (toast && toast.duration && toast.duration > 0) {
      // Reset timer to full duration on resume for better UX
      if (toast.timer) clearTimeout(toast.timer);
      toast.timer = setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }
  };

  return {
    toasts,
    addToast,
    removeToast,
    pauseToast,
    resumeToast
  };
}
