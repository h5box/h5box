/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import JSZip from 'jszip';

declare const self: ServiceWorkerGlobalScope;
// @ts-ignore
self.__WB_DISABLE_DEV_LOGS = true;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Skip standard resources in dev mode to avoid "No route found" warnings
// In production, these are handled by precache or standard fetch
// In dev, we just let them pass through if not intercepted
registerRoute(
    () => {
        // Allow all local dev resources to pass through without warning
        // but DO NOT return true (which would mean we handle it)
        // actually we just want to avoid the "No route found" noise if we had a catch-all
        // Workbox by default logs warnings for unhandled requests in dev.
        // We can silence this by registering a route that just returns networkFirst or similar,
        // OR better: in vite config suppress warnings.
        // But if user wants to prevent the 2s refresh, that's likely due to 
        // a claimClients causing a reload or something similar.
        return false;
    },
    async () => { return new Response(); }
);

// -------------------------------------------------------------------------
// Custom Logic for HTML App Launcher
// -------------------------------------------------------------------------

const DB_NAME = 'html-app-launcher';
const DB_VERSION = 2;

self.addEventListener('install', () => {
  console.log('SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activating & Claiming clients...');
  event.waitUntil(self.clients.claim());
});

// Helper for handling app requests
const appHandler = async ({ url }: { url: URL; params?: any }) => {
     // params is an array-like object in RegExp route or passed from NavigationRoute
     // For RegExp: [fullMatch, group1, group2]
     // For NavigationRoute: we might need to parse manually if regex isn't used in same way
     
     // Let's use the URL pathname to be safe and consistent
     // CHANGED: Use a regex that allows a prefix (e.g. /repo-name/app/...) to support GitHub Pages subdirectories
     const match = /(?:^|\/)app\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
     if (!match) return new Response('Invalid App URL', { status: 400 });

     const appId = match[1];
     let filePath = match[2] || 'index.html';
  
     console.log('SW: Intercepted App Request:', url.pathname, 'AppId:', appId, 'Path:', filePath);
  
     // Clean up query params
     if (filePath.includes('?')) {
       filePath = filePath.split('?')[0];
     }
     
     // Handle root path or empty file path
     if (filePath === '' || filePath.endsWith('/')) {
         filePath += 'index.html';
     }
 
     return handleAppRequest(appId, filePath);
};

// 1. Handle Navigation requests specifically (HTML)
// This ensures that typing the URL in the bar or refreshing works
const navigationRoute = new NavigationRoute(appHandler, {
  allowlist: [
    /\/app\//, // Match /app/ anywhere in the path
  ],
});
registerRoute(navigationRoute);

// 2. Handle sub-resource requests (CSS, JS, Images inside the app)
// These are not navigations but standard fetches
registerRoute(
   ({ url }) => url.pathname.includes('/app/'),
   appHandler
);



async function handleAppRequest(appId: string, filePath: string) {
  try {
    const appData: any = await getAppFromDB(appId);
    if (!appData) {
      console.error(`App ${appId} not found in DB`);
      return new Response(createErrorPage('App not found', `The app with ID "${appId}" was not found in the local database.`), { 
          status: 404,
          headers: { 'Content-Type': 'text/html' }
      });
    }

    const zip = await JSZip.loadAsync(appData.zipBlob);
    
    // Basic file lookup
    let targetPath = filePath;
    if (appData.rootPrefix) {
        targetPath = appData.rootPrefix + filePath;
    }
    
    let file = zip.file(targetPath);
    
    // Fallback logic
    if (!file) {
       // 1. Try adding index.html if looking for a folder
       if (targetPath.endsWith('/') || targetPath === '' || !targetPath.includes('.')) {
          const tryIndex = targetPath + (targetPath.endsWith('/') ? '' : '/') + 'index.html';
          file = zip.file(tryIndex);
       }
       
       // 2. Try without rootPrefix (if it was somehow incorrect)
       if (!file && targetPath !== filePath) {
            file = zip.file(filePath);
       }
       
       // 3. Try filePath + index.html without rootPrefix
       if (!file && (filePath.endsWith('/') || !filePath.includes('.'))) {
           file = zip.file(filePath + (filePath.endsWith('/') ? '' : '/') + 'index.html');
       }
    }

    if (!file) {
      console.error(`File ${targetPath} (orig: ${filePath}) not found in app ${appId}`);
      // Check if we can list files to help debugging
      const files = Object.keys(zip.files).slice(0, 10).join('<br>');
      return new Response(createErrorPage('File not found', `
        <p>Could not find file: <strong>${filePath}</strong></p>
        <p>Target path: <strong>${targetPath}</strong></p>
        <p>Root Prefix: <strong>${appData.rootPrefix || '(none)'}</strong></p>
        <hr>
        <p>Files in ZIP (first 10):<br>${files}</p>
      `), { 
          status: 404, 
          headers: { 'Content-Type': 'text/html' }
      });
    }

    const content = await file.async('blob');
    const mimeType = getMimeType(filePath);
    
    console.log(`SW: Serving ${filePath} as ${mimeType} (Size: ${content.size})`);

    // Inject Security Shim for HTML files
    if (mimeType === 'text/html') {
        let html = await content.text();
        const shim = getSecurityShim(appId);
        
        // Inject as early as possible in the head
        if (html.includes('<head>')) {
            html = html.replace('<head>', '<head>' + shim);
        } else if (html.includes('<!DOCTYPE html>')) {
            html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>' + shim);
        } else {
            html = shim + html;
        }

        return new Response(html, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache'
            }
        });
    }

    return new Response(content, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (err: any) {
    console.error('Error in SW handleAppRequest:', err);
    return new Response(createErrorPage('System Error', `
        <p>An error occurred while loading the application.</p>
        <pre>${err.message || String(err)}</pre>
    `), { 
        status: 500,
        headers: { 'Content-Type': 'text/html' }
    });
  }
}

function createErrorPage(title: string, message: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Error - ${title}</title>
        <style>
            body { font-family: -apple-system, sans-serif; padding: 20px; color: #333; line-height: 1.5; }
            h1 { color: #e11d48; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            pre { background: #f1f5f9; padding: 10px; border-radius: 4px; overflow: auto; }
            .info { background: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; }
        </style>
    </head>
    <body>
        <h1>${title}</h1>
        <div class="info">
            ${message}
        </div>
    </body>
    </html>
    `;
}

function getAppFromDB(id: string) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('apps')) {
          resolve(null);
          return;
      }
      const tx = db.transaction('apps', 'readonly');
      const store = tx.objectStore('apps');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          resolve(getReq.result); // Return full object
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    };
  });
}

function getMimeType(filename: string) {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  const map: Record<string, string> = {
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'txt': 'text/plain',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'otf': 'font/otf',
    'wasm': 'application/wasm'
  };
  return (ext && map[ext]) || 'application/octet-stream';
}

function getSecurityShim(appId: string) {
    return `
    <script>
    (function() {
      console.log("[Security] Initializing App Sandbox for ${appId}...");
      
      const APP_ID = "${appId}";
      // Use a safe prefix that won't conflict with system DB
      const PREFIX = "app_" + APP_ID + "_";
      
      // --- IndexedDB Proxy ---
      const originalOpen = window.indexedDB.open.bind(window.indexedDB);
      const originalDelete = window.indexedDB.deleteDatabase.bind(window.indexedDB);
      
      window.indexedDB.open = function(name, version) {
        // Prevent access to system DB by enforcing prefix
        const newName = PREFIX + name;
        console.log("[Security] Sandboxing IndexedDB: " + name + " -> " + newName);
        return originalOpen(newName, version);
      };
      
      window.indexedDB.deleteDatabase = function(name) {
        const newName = PREFIX + name;
        return originalDelete(newName);
      };
      
      // --- LocalStorage Proxy (Basic) ---
      const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
      const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
      const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      
      window.localStorage.setItem = function(key, value) {
        originalSetItem(PREFIX + key, value);
      };
      
      window.localStorage.getItem = function(key) {
        return originalGetItem(PREFIX + key);
      };
      
      window.localStorage.removeItem = function(key) {
        originalRemoveItem(PREFIX + key);
      };
      
      console.log("[Security] Sandbox Active.");
    })();
    </script>
    `;
}
