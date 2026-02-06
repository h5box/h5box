import { ref, watchEffect } from 'vue';

export type OpenMethod = 'window' | 'popup'; // 'window' = internal component (Current Page), 'popup' = new browser window

// Check if PC (simple check)
const isPC = typeof navigator !== 'undefined' && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const defaultMethod = isPC ? 'popup' : 'window';

const openMethod = ref<OpenMethod>((localStorage.getItem('open_method') as OpenMethod) || defaultMethod);

export function useSettings() {
  watchEffect(() => {
    localStorage.setItem('open_method', openMethod.value);
  });

  return {
    openMethod,
    setOpenMethod: (method: OpenMethod) => {
      openMethod.value = method;
    }
  };
}
