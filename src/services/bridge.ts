import { db } from '../db';
import { permissionService } from './permissionService';

export type BridgeMessage = {
  type: string;
  payload?: any;
  requestId: string;
};

export const handleBridgeMessage = async (
  event: MessageEvent, 
  sourceAppId: string, 
  sourceWindow: WindowProxy,
  callbacks?: { onOpenApp?: (appId: string) => void },
  options?: { isPopup?: boolean }
): Promise<{ type: string; success: boolean } | void> => {
  const { data } = event;
  // Basic validation
  if (!data || typeof data !== 'object' || !data.type) return;

  const { type, payload, requestId } = data;
  console.log(`[Bridge] Processing ${type} from ${sourceAppId}`, payload);
  
  try {
    let result;
    switch (type) {
      case 'system.requestPermissions':
        result = await permissionService.requestPermissions(sourceAppId, payload.permissions || [], { popup: options?.isPopup });
        break;
      case 'system.installApp':
        await checkPermission(sourceAppId, 'system.installApp');
        result = await handleInstallApp(payload, sourceAppId);
        break;
      case 'system.getInstalledApps':
        await checkPermission(sourceAppId, 'system.getInstalledApps');
        result = await handleGetInstalledApps();
        break;
      case 'system.uninstallApp':
        await checkPermission(sourceAppId, 'system.uninstallApp');
        result = await handleUninstallApp(payload);
        break;
      case 'system.openApp':
        await checkPermission(sourceAppId, 'system.openApp');
        if (!payload.appId) throw new Error('Missing appId');
        // Check existence
        const targetApp = await db.getApp(payload.appId);
        if (!targetApp) throw new Error(`App ${payload.appId} not found`);
        
        if (callbacks?.onOpenApp) {
            callbacks.onOpenApp(payload.appId);
            result = { success: true };
        } else {
            throw new Error('Host system does not support opening apps');
        }
        break;
      case 'system.getAppSource':
        await checkPermission(sourceAppId, 'system.readAppSource');
        result = await handleGetAppSource(payload);
        break;
      default:
        console.warn(`[Bridge] Unknown message type: ${type}`);
        return; 
    }
    
    // Send response
    sourceWindow.postMessage({
         type: `${type}.result`,
         payload: result,
         requestId,
         success: true
    }, '*');

    return { type, success: true };

  } catch (error: any) {
    console.error(`[Bridge] Error handling ${type}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sourceWindow.postMessage({
         type: `${type}.result`,
         error: errorMessage || 'Unknown error occurred in bridge',
         requestId,
         success: false
    }, '*');

    return { type, success: false };
  }
};

async function checkPermission(appId: string, permission: string) {
    const has = await permissionService.hasPermission(appId, permission);
    if (!has) {
        throw new Error(`Permission denied: ${permission}. Please request permission first.`);
    }
}

async function handleInstallApp(payload: { file?: Blob; appIdentifier?: string; title?: string; icon?: string; version?: string }, sourceAppId: string) {
    let file: File;

    if (payload.file) {
        file = new File([payload.file], 'app.zip', { type: 'application/zip' });
    } else {
        throw new Error('Missing File. URL installation is no longer supported.');
    }

    // 3. Install
    // Use appStore to leverage smart install features (like update confirmation)
    // However, bridge is a service, not a store. We need to access store.
    // But we are outside of component setup. We can import store if pinia is active.
    // Assuming Pinia is active when bridge is running (it should be).
    
    // Dynamically import store to avoid circular deps or init issues? 
    // Usually fine if called at runtime.
    const { useAppStore } = await import('../stores/apps');
    const appStore = useAppStore();
    
    // We need to wait for the installation to complete or fail.
    // installFromFileSmart handles UI states but also throws on error? 
    // It catches errors and sets state.error. We need to check that.
    
    // We want to pass metadata overrides. installFromFileSmart calls installSingleFromFile.
    // installSingleFromFile calls installApp.
    // But installFromFileSmart signature is (file, source). It doesn't accept overrides.
    // We should modify installFromFileSmart or call installSingleFromFile directly?
    // installFromFileSmart does restore logic which we probably don't need for API install.
    // So we can call installSingleFromFile directly, but we need to inject metadata overrides.
    
    // Wait, installSingleFromFile calls installApp with metadataOverrides: { installSource }.
    // It doesn't allow passing other overrides.
    
    // Let's modify installSingleFromFile to accept overrides or make a new method in store?
    // Or we can modify the file object? No, metadata comes from parsing.
    
    // Best approach: Call installApp directly first to parse/prepare, then use store logic to save/update.
    // Actually, store.installSingleFromFile logic is: 
    // 1. installApp(persist: 'none') -> gets metadata
    // 2. checks duplicates/updates
    // 3. saves to DB
    
    // We should duplicate some logic or refactor store.
    // Let's assume we can add a method to store or use existing one if we modify it.
    // Modifying store seems best for consistency.
    
    // Let's call a new action in store: installFromBridge(file, overrides, source)
    
    // Get source app info to use package name if available
    const sourceApp = await db.getApp(sourceAppId);
    const sourceName = sourceApp?.appIdentifier || sourceAppId;

    const overrides: { appIdentifier?: string; title?: string; icon?: string; version?: string } = {};
    if (payload.appIdentifier) overrides.appIdentifier = payload.appIdentifier;
    if (payload.title) overrides.title = payload.title;
    if (payload.icon) overrides.icon = payload.icon;
    if (payload.version) overrides.version = payload.version;

    const installedApp = await appStore.installFromBridge(file, overrides, `App:${sourceName}`);

    // The store action should return the installed app or throw.
    // Since we are adding a new action, let's look at the plan.
    
    // For now, I'll use a slightly different approach:
    // I will modify installSingleFromFile in apps.ts to accept optional overrides.
    // But first, let's update bridge.ts to use the store.
    
    // Since I can't easily modify store signature without checking all usages, 
    // I will implement a helper here that mimics store logic or (better)
    // I will update apps.ts to support overrides in installSingleFromFile.
    
    // const installedApp = appStore.apps[appStore.apps.length - 1]; // This is risky.
    // Better: installFromBridge returns the app.
    
    return { appId: installedApp?.id, title: installedApp?.title };
}

async function handleGetInstalledApps() {
    const apps = await db.getAllApps();
    console.log(`[Bridge] Found ${apps.length} apps installed`);
    return apps.map(a => ({
        id: a.id,
        title: a.title,
        version: a.version,
        description: a.description,
        icon: a.icon,
        author: a.author,
        installTime: a.installTime,
        keywords: a.keywords,
        installSource: a.installSource,
        appIdentifier: a.appIdentifier,
        repository: a.repository,
        website: a.officialWebsite
    }));
}

async function handleUninstallApp(payload: { appId: string }) {
    if (!payload.appId) throw new Error('Missing appId');
    
    // Permission already checked.
    await db.deleteApp(payload.appId);
    return { success: true };
}

async function handleGetAppSource(payload: { appId: string }) {
    if (!payload.appId) throw new Error('Missing appId');
    const app = await db.getApp(payload.appId);
    if (!app) throw new Error('App not found');
    if (!app.zipBlob) throw new Error('Source not available');
    return { blob: app.zipBlob, filename: `${app.id}.zip` };
}
