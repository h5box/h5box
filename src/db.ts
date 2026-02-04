import { openDB, type DBSchema } from 'idb';

export interface AppMetadata {
  id: string;
  title: string;
  description: string;
  icon: string; // Base64 string for the icon
  author: string;
  version: string;
  appIdentifier?: string; // e.g. author/repo
  officialWebsite?: string;
  installSource?: string; // 'Market', 'Local', 'URL'
  rootPrefix?: string; // Optional root folder inside ZIP
  keywords: string[];
  installTime: number;
  zipBlob: Blob; 
  order?: number;
  repository?: string;
  isNew?: boolean;
}

interface AppDB extends DBSchema {
  apps: {
    key: string;
    value: AppMetadata;
  };
  windowStates: {
    key: string;
    value: { x: number; y: number; width: number; height: number; key: string };
  };
  permissions: {
    key: string; // appId
    value: { appId: string; permissions: string[] };
  };
}

export const DB_NAME = 'html-app-launcher';
export const DB_VERSION = 2;

const dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('apps')) {
      db.createObjectStore('apps', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('windowStates')) {
      db.createObjectStore('windowStates', { keyPath: 'key' }); // key is appId
    }
    if (!db.objectStoreNames.contains('permissions')) {
      db.createObjectStore('permissions', { keyPath: 'appId' });
    }
  },
});

export const db = {
  async addApp(app: AppMetadata) {
    return (await dbPromise).put('apps', app);
  },
  async getApp(id: string) {
    return (await dbPromise).get('apps', id);
  },
  async getAllApps() {
    return (await dbPromise).getAll('apps');
  },
  async deleteApp(id: string) {
    const tx = (await dbPromise).transaction(['apps', 'permissions'], 'readwrite');
    await tx.objectStore('apps').delete(id);
    await tx.objectStore('permissions').delete(id);
    return tx.done;
  },
  async saveWindowState(appId: string, state: { x: number; y: number; width: number; height: number }) {
    // When using keyPath, the value must contain the key.
    // However, we previously defined store with { keyPath: 'key' }.
    // So we must include 'key' in the value.
    // Also, if keyPath is set, the second argument to put() (key) should NOT be used or is ignored/error?
    // Actually, idb wrapper might handle it, but raw IDB throws DataError if key provided differs from keyPath.
    // Best practice: include key in object.
    return (await dbPromise).put('windowStates', { ...state, key: appId });
  },
  async getWindowState(appId: string) {
    return (await dbPromise).get('windowStates', appId);
  },
  async updateApp(app: AppMetadata) {
    return (await dbPromise).put('apps', app);
  },
  async getPermissions(appId: string) {
    const record = await (await dbPromise).get('permissions', appId);
    return record ? record.permissions : [];
  },
  async setPermissions(appId: string, permissions: string[]) {
    return (await dbPromise).put('permissions', { appId, permissions });
  }
};
