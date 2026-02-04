import { ref, watchEffect } from 'vue';

type ThemeMode = 'light' | 'dark' | 'system';

const themeMode = ref<ThemeMode>((localStorage.getItem('theme_mode') as ThemeMode) || 'system');
const isDark = ref(false);

export function useTheme() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const updateDocumentClass = (dark: boolean) => {
    isDark.value = dark;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Initial sync
  const syncTheme = () => {
    if (themeMode.value === 'system') {
      updateDocumentClass(mediaQuery.matches);
    } else {
      updateDocumentClass(themeMode.value === 'dark');
    }
  };

  // Watch for mode changes
  watchEffect(() => {
    localStorage.setItem('theme_mode', themeMode.value);
    syncTheme();
  });

  // Listen for system changes
  // Note: This listener is global. Since useTheme is a composable, we should be careful not to add multiple listeners if called multiple times.
  // Ideally, this logic should be a singleton or outside the function.
  // For simplicity in this setup, we'll check if the listener is already attached or just rely on the fact that this is likely initialized once or okay to have multiple (though wasteful).
  // A better pattern for global state is to keep the state outside.
  
  // We'll just add the listener once globally if we can, but since we are in a module, we can just add it once.
  // However, `mediaQuery.addEventListener` is safe to call.
  
  // Let's rely on the watchEffect and the global state defined outside.
  // We need to ensure the system listener is active.
  
  return {
    themeMode,
    isDark,
    setTheme: (mode: ThemeMode) => {
      themeMode.value = mode;
    }
  };
}

// Initialize system listener once
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const mode = localStorage.getItem('theme_mode') as ThemeMode || 'system';
    if (mode === 'system') {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}
