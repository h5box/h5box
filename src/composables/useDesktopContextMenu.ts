import { nextTick, ref } from 'vue';

export function useDesktopContextMenu() {
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    appId: ''
  });
  const contextMenuRef = ref<HTMLElement | null>(null);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const repositionContextMenu = async () => {
    await nextTick();
    const element = contextMenuRef.value;
    if (!element) return;

    const margin = 8;
    contextMenu.value.x = clamp(contextMenu.value.x, margin, window.innerWidth - element.offsetWidth - margin);
    contextMenu.value.y = clamp(contextMenu.value.y, margin, window.innerHeight - element.offsetHeight - margin);
  };

  const showContextMenu = (x: number, y: number, appId = '') => {
    contextMenu.value = {
      visible: true,
      x,
      y,
      appId
    };
    void repositionContextMenu();
  };

  const closeContextMenu = () => {
    contextMenu.value.visible = false;
  };

  return {
    contextMenu,
    contextMenuRef,
    showContextMenu,
    closeContextMenu
  };
}
