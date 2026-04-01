import { ref } from 'vue';
import type { AppMetadata } from '../db';

const APP_POPUP_SIZE_RATIO = 0.65;

export function useWindowManager() {
  const openWindows = ref<string[]>([]);
  const windowZIndices = ref<Record<string, number>>({});
  const popupWindows = new Map<Window, string>();
  let maxZIndex = 100;

  const getPopupFeatures = () => {
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;
    const width = Math.floor(screenW * APP_POPUP_SIZE_RATIO);
    const height = Math.floor(screenH * APP_POPUP_SIZE_RATIO);
    const left = (screenW - width) / 2;
    const top = (screenH - height) / 2;

    return {
      features: `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    };
  };

  const getExternalLaunchUrl = (app: AppMetadata) => {
    if (app.launchMode !== 'external') return '';
    return app.officialWebsite?.trim() || '';
  };

  const openApp = (id: string) => {
    if (!openWindows.value.includes(id)) {
      openWindows.value.push(id);
    }
    bringToFront(id);
  };

  const closeApp = (id: string) => {
    openWindows.value = openWindows.value.filter(windowId => windowId !== id);
    delete windowZIndices.value[id];
  };

  const bringToFront = (id: string) => {
    maxZIndex += 1;
    windowZIndices.value[id] = maxZIndex;
  };

  const getZIndex = (id: string) => windowZIndices.value[id] || 100;

  const openAppInPopup = (
    app: AppMetadata,
    targetUrl: string,
    onBlocked?: () => void
  ) => {
    const { features } = getPopupFeatures();
    const popup = window.open(targetUrl, '_blank', features);
    if (!popup) {
      onBlocked?.();
      return false;
    }

    if (!getExternalLaunchUrl(app)) {
      popupWindows.set(popup, app.id);
    }

    return true;
  };

  return {
    openWindows,
    popupWindows,
    getExternalLaunchUrl,
    openApp,
    closeApp,
    bringToFront,
    getZIndex,
    openAppInPopup
  };
}
