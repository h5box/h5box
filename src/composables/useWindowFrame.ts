import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { db, type AppMetadata } from '../db';

export function useWindowFrame(app: AppMetadata, zIndex: () => number, isOpen: () => boolean) {
  const x = ref(100);
  const y = ref(100);
  const width = ref(800);
  const height = ref(600);
  const isDragging = ref(false);
  const isResizing = ref(false);
  const isMaximized = ref(false);
  const dragOffset = { x: 0, y: 0 };

  const windowStyle = computed(() => {
    if (isMaximized.value) {
      return {
        left: '0px',
        top: '0px',
        width: '100%',
        height: '100%',
        zIndex: zIndex(),
        borderRadius: '0'
      };
    }

    return {
      left: `${x.value}px`,
      top: `${y.value}px`,
      width: `${width.value}px`,
      height: `${height.value}px`,
      zIndex: zIndex()
    };
  });

  const loadState = async () => {
    try {
      const state = await db.getWindowState(app.id);
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        isMaximized.value = true;
        width.value = window.innerWidth;
        height.value = window.innerHeight;
        x.value = 0;
        y.value = 0;
        return;
      }

      if (state) {
        x.value = state.x;
        y.value = Math.max(0, state.y);
        width.value = state.width;
        height.value = state.height;
        return;
      }

      width.value = 800;
      height.value = 600;
      x.value = Math.max(0, (window.innerWidth - 800) / 2 + (Math.random() * 40 - 20));
      y.value = Math.max(0, (window.innerHeight - 600) / 2 + (Math.random() * 40 - 20));
    } catch (error) {
      console.error('Failed to load window state', error);
    }
  };

  const saveState = async () => {
    try {
      await db.saveWindowState(app.id, {
        x: x.value,
        y: y.value,
        width: width.value,
        height: height.value
      });
    } catch (error) {
      console.error('Failed to save window state', error);
    }
  };

  const stopDrag = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    void saveState();
  };

  const onDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;
    x.value = e.clientX - dragOffset.x;
    y.value = Math.max(0, e.clientY - dragOffset.y);
  };

  const startDrag = (e: MouseEvent) => {
    isDragging.value = true;
    dragOffset.x = e.clientX - x.value;
    dragOffset.y = e.clientY - y.value;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const stopTouchDrag = () => {
    isDragging.value = false;
    window.removeEventListener('touchmove', onTouchDrag);
    window.removeEventListener('touchend', stopTouchDrag);
    void saveState();
  };

  const onTouchDrag = (e: TouchEvent) => {
    if (!isDragging.value) return;
    e.preventDefault();
    const touch = e.touches[0];
    x.value = touch.clientX - dragOffset.x;
    y.value = Math.max(0, touch.clientY - dragOffset.y);
  };

  const startTouchDrag = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    isDragging.value = true;
    dragOffset.x = touch.clientX - x.value;
    dragOffset.y = touch.clientY - y.value;
    window.addEventListener('touchmove', onTouchDrag, { passive: false });
    window.addEventListener('touchend', stopTouchDrag);
  };

  const stopResize = () => {
    isResizing.value = false;
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
    void saveState();
  };

  const onResize = (e: MouseEvent) => {
    if (!isResizing.value) return;
    width.value = Math.max(200, e.clientX - x.value);
    height.value = Math.max(200, e.clientY - y.value);
  };

  const startResize = () => {
    isResizing.value = true;
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResize);
  };

  const stopTouchResize = () => {
    isResizing.value = false;
    window.removeEventListener('touchmove', onTouchResize);
    window.removeEventListener('touchend', stopTouchResize);
    void saveState();
  };

  const onTouchResize = (e: TouchEvent) => {
    if (!isResizing.value) return;
    e.preventDefault();
    const touch = e.touches[0];
    width.value = Math.max(200, touch.clientX - x.value);
    height.value = Math.max(200, touch.clientY - y.value);
  };

  const startTouchResize = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    isResizing.value = true;
    window.addEventListener('touchmove', onTouchResize, { passive: false });
    window.addEventListener('touchend', stopTouchResize);
  };

  const toggleMaximize = () => {
    isMaximized.value = !isMaximized.value;
  };

  watch(isOpen, (nextOpen) => {
    if (nextOpen) {
      void loadState();
    }
  });

  onMounted(() => {
    if (isOpen()) {
      void loadState();
    }
  });

  onUnmounted(() => {
    stopDrag();
    stopResize();
    stopTouchDrag();
    stopTouchResize();
  });

  return {
    isDragging,
    isResizing,
    isMaximized,
    windowStyle,
    saveState,
    startDrag,
    startTouchDrag,
    startResize,
    startTouchResize,
    toggleMaximize
  };
}
