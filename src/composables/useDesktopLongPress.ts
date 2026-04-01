import { ref } from 'vue';

export function useDesktopLongPress(onLongPress: (x: number, y: number) => void) {
  const isDesktopLongPress = ref(false);
  const desktopLongPressTimer = ref<number | undefined>(undefined);

  const handleDesktopTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('.js-app-icon')) return;

    isDesktopLongPress.value = false;
    desktopLongPressTimer.value = window.setTimeout(() => {
      isDesktopLongPress.value = true;
      const touch = e.touches[0];
      onLongPress(touch.clientX, touch.clientY);
    }, 500);
  };

  const handleDesktopTouchMove = () => {
    clearTimeout(desktopLongPressTimer.value);
  };

  const handleDesktopTouchEnd = (e: TouchEvent) => {
    clearTimeout(desktopLongPressTimer.value);
    if (isDesktopLongPress.value) {
      e.preventDefault();
    }
  };

  return {
    handleDesktopTouchStart,
    handleDesktopTouchMove,
    handleDesktopTouchEnd
  };
}
