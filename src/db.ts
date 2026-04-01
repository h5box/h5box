import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  APP_FILE_STORE_NAME,
  APP_STORE_NAME,
  DB_NAME,
  DB_VERSION,
  PERMISSION_STORE_NAME,
  WINDOW_STATE_STORE_NAME
} from './constants/storage';

export type AppLaunchMode = 'embedded' | 'external';

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
  launchMode?: AppLaunchMode;
}

export interface AppFileRecord {
  key: string;
  appId: string;
  path: string;
  content: Blob;
  contentType: string;
}

interface AppDB extends DBSchema {
  [APP_STORE_NAME]: {
    key: string;
    value: AppMetadata;
  };
  [APP_FILE_STORE_NAME]: {
    key: string;
    value: AppFileRecord;
    indexes: {
      'by-appId': string;
    };
  };
  [WINDOW_STATE_STORE_NAME]: {
    key: string;
    value: { x: number; y: number; width: number; height: number; key: string };
  };
  [PERMISSION_STORE_NAME]: {
    key: string; // appId
    value: { appId: string; permissions: string[] };
  };
}

const dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(APP_STORE_NAME)) {
      db.createObjectStore(APP_STORE_NAME, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(APP_FILE_STORE_NAME)) {
      const appFilesStore = db.createObjectStore(APP_FILE_STORE_NAME, { keyPath: 'key' });
      appFilesStore.createIndex('by-appId', 'appId');
    }
    if (!db.objectStoreNames.contains(WINDOW_STATE_STORE_NAME)) {
      db.createObjectStore(WINDOW_STATE_STORE_NAME, { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains(PERMISSION_STORE_NAME)) {
      db.createObjectStore(PERMISSION_STORE_NAME, { keyPath: 'appId' });
    }
  },
  blocked() {
    console.warn('Database upgrade is blocked by another open tab.');
  }
});

async function deleteAppFilesInTransaction(
  tx: any,
  appId: string
) {
  const index = tx.objectStore(APP_FILE_STORE_NAME).index('by-appId');
  let cursor = await index.openCursor(appId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
}

async function saveAppBundleInDatabase(
  database: IDBPDatabase<AppDB>,
  app: AppMetadata,
  files: AppFileRecord[]
) {
  const tx = database.transaction([APP_STORE_NAME, APP_FILE_STORE_NAME], 'readwrite');
  await tx.objectStore(APP_STORE_NAME).put(app);
  await deleteAppFilesInTransaction(tx, app.id);
  for (const file of files) {
    await tx.objectStore(APP_FILE_STORE_NAME).put(file);
  }
  await tx.done;
}

export { DB_NAME, DB_VERSION } from './constants/storage';

export const db = {
  async addApp(app: AppMetadata) {
    return (await dbPromise).put(APP_STORE_NAME, app);
  },
  async getApp(id: string) {
    return (await dbPromise).get(APP_STORE_NAME, id);
  },
  async getAllApps() {
    return (await dbPromise).getAll(APP_STORE_NAME);
  },
  async saveAppBundle(app: AppMetadata, files: AppFileRecord[]) {
    const database = await dbPromise;
    return saveAppBundleInDatabase(database, app, files);
  },
  async getAppFile(appId: string, path: string) {
    return (await dbPromise).get(APP_FILE_STORE_NAME, `${appId}:${path}`);
  },
  async listAppFiles(appId: string) {
    return (await dbPromise).getAllFromIndex(APP_FILE_STORE_NAME, 'by-appId', appId);
  },
  async deleteApp(id: string) {
    const database = await dbPromise;
    const tx = database.transaction([APP_STORE_NAME, APP_FILE_STORE_NAME, PERMISSION_STORE_NAME], 'readwrite');
    await tx.objectStore(APP_STORE_NAME).delete(id);
    await deleteAppFilesInTransaction(tx, id);
    await tx.objectStore(PERMISSION_STORE_NAME).delete(id);
    return tx.done;
  },
  async saveWindowState(appId: string, state: { x: number; y: number; width: number; height: number }) {
    return (await dbPromise).put(WINDOW_STATE_STORE_NAME, { ...state, key: appId });
  },
  async getWindowState(appId: string) {
    return (await dbPromise).get(WINDOW_STATE_STORE_NAME, appId);
  },
  async updateApp(app: AppMetadata) {
    return (await dbPromise).put(APP_STORE_NAME, app);
  },
  async getPermissions(appId: string) {
    const record = await (await dbPromise).get(PERMISSION_STORE_NAME, appId);
    return record ? record.permissions : [];
  },
  async setPermissions(appId: string, permissions: string[]) {
    return (await dbPromise).put(PERMISSION_STORE_NAME, { appId, permissions });
  }
};
