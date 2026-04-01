import JSZip from 'jszip';
import type { AppFileRecord, AppLaunchMode, AppMetadata } from '../db';
import { getMimeType } from '../utils/mime';

export async function calculateFileHash(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // Return first 16 characters
}

async function calculateStringHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}

function generateDefaultIcon(title: string): string {
  const colors = [
    ['#f87171', '#ef4444'], // red
    ['#fb923c', '#f97316'], // orange
    ['#fbbf24', '#f59e0b'], // amber
    ['#a3e635', '#84cc16'], // lime
    ['#34d399', '#10b981'], // emerald
    ['#22d3ee', '#06b6d4'], // cyan
    ['#60a5fa', '#3b82f6'], // blue
    ['#818cf8', '#6366f1'], // indigo
    ['#a78bfa', '#8b5cf6'], // violet
    ['#f472b6', '#ec4899'], // pink
  ];
  
  // Pick color based on title hash
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const [startColor, endColor] = colors[colorIndex];
  
  const char = title.charAt(0).toUpperCase() || 'A';
  
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#grad)" />
  <text x="50" y="50" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${char}</text>
</svg>`.trim();

  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function getBrowserUser(): string {
  const KEY = 'br_user_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // Generate simple ID starting with BR
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    id = `BR${random}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

type ParseAppOptions = {
  id?: string;
  installTime?: number;
  installSource?: string;
  metadataOverrides?: Partial<Omit<AppMetadata, 'id' | 'zipBlob' | 'installTime' | 'rootPrefix'>>;
};

export async function parseAppPackage(
  file: File,
  options?: ParseAppOptions
): Promise<{ app: AppMetadata; files: AppFileRecord[] }> {
  let zip: JSZip;
  try {
      zip = await JSZip.loadAsync(file);
  } catch (e) {
      throw new Error('Failed to load ZIP file. Is it a valid ZIP?');
  }

  // Find index.html
  // Support index.html in root or in a single top-level folder
  let indexFile = zip.file('index.html');
  let rootPrefix = '';
  
  if (!indexFile) {
    // Check if there is a single folder
    const rootFolders = Object.keys(zip.files).filter(path => path.endsWith('/') && path.split('/').length === 2);
    if (rootFolders.length === 1) {
        rootPrefix = rootFolders[0];
        indexFile = zip.file(rootPrefix + 'index.html');
    }
  }

  if (!indexFile) {
    throw new Error('Invalid app: index.html not found in root or first level folder.');
  }
  
  const htmlContent = await indexFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  const title = doc.querySelector('title')?.textContent?.trim() || file.name.replace(/\.zip$/i, '');
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') || 'Unknown';
  const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',').map(k => k.trim()).filter(Boolean) || [];
  const version = doc.querySelector('meta[name="version"]')?.getAttribute('content') || '1.0.0';
  const launchModeMeta = doc.querySelector('meta[name="app-launch-mode"]')?.getAttribute('content');
  const launchMode: AppLaunchMode = launchModeMeta === 'external' ? 'external' : 'embedded';
  
  // New: appIdentifier
  let appIdentifier = doc.querySelector('meta[name="app-identifier"]')?.getAttribute('content');
  
  // Official Website: Check meta first, then link[rel="canonical"]
  let officialWebsite = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined;

  
  if (!appIdentifier) {
      // Generate hash from title to ensure consistency for same app name
      const hash = await calculateStringHash(title+author);
      appIdentifier = `${getBrowserUser()}/app-${hash.substring(0, 10)}`;
  }

  // Icon handling
  let icon = ''; 
  const iconLink = doc.querySelector('link[rel="icon"]') || doc.querySelector('link[rel="shortcut icon"]');
  
  if (iconLink) {
    const iconHref = iconLink.getAttribute('href');
    if (iconHref) {
      if (!iconHref.startsWith('http') && !iconHref.startsWith('data:') && !iconHref.startsWith('//')) {
          // Resolve path relative to index.html (which is at rootPrefix)
          // Simple resolution: join paths
          let iconPath = rootPrefix + iconHref;
          
          // Handle cases where iconHref might start with ./ or /
          if (iconHref.startsWith('./')) {
             iconPath = rootPrefix + iconHref.slice(2);
          } else if (iconHref.startsWith('/')) {
             // If absolute path from root of zip
             iconPath = rootPrefix + iconHref.slice(1);
          }

          // JSZip file lookups are case sensitive and need exact paths
          // Remove any leading ./ if somehow still there
          
          const iconFile = zip.file(iconPath);
          if (iconFile) {
              const iconBlob = await iconFile.async('blob');
              // Fix: FileReader might guess wrong MIME for SVG, or if it's generic binary.
              // We should force correct MIME if it's svg
              if (iconPath.toLowerCase().endsWith('.svg')) {
                 const svgBlob = new Blob([iconBlob], { type: 'image/svg+xml' });
                 icon = await blobToBase64(svgBlob);
              } else {
                 icon = await blobToBase64(iconBlob);
              }
          } else {
             console.warn('Icon file not found in zip:', iconPath);
             // Try case insensitive search? Or try looking in root if fail?
          }
      } else if (iconHref.startsWith('http') || iconHref.startsWith('//')) {
          icon = iconHref;
      } else if (iconHref.startsWith('data:')) {
          icon = iconHref;
      }
    }
  }

  // Generate default icon if none found
  if (!icon) {
      icon = generateDefaultIcon(title);
  }

  const id = options?.id || await calculateFileHash(file);
  const installTime = options?.installTime ?? Date.now();
  
  const app: AppMetadata = {
    id,
    title,
    description,
    author,
    version,
    rootPrefix,
    keywords,
    icon,
    installTime,
    installSource: options?.installSource,
    zipBlob: file,
    appIdentifier,
    officialWebsite,
    launchMode
  };
  
  const overrides = options?.metadataOverrides || {};
  const merged: AppMetadata = {
    ...app,
    ...overrides
  };

  const files = await extractAppFiles(zip, id, rootPrefix);

  return {
    app: merged,
    files
  };
}

async function extractAppFiles(zip: JSZip, appId: string, rootPrefix: string) {
  const fileEntries = Object.values(zip.files).filter(fileEntry => {
    if (fileEntry.dir) return false;
    return rootPrefix ? fileEntry.name.startsWith(rootPrefix) : true;
  });

  const extractedFiles = await Promise.all(
    fileEntries.map(async fileEntry => {
      const relativePath = normalizeAppFilePath(fileEntry.name, rootPrefix);
      const content = await fileEntry.async('blob');
      return {
        key: `${appId}:${relativePath}`,
        appId,
        path: relativePath,
        content,
        contentType: getMimeType(relativePath)
      } satisfies AppFileRecord;
    })
  );

  return extractedFiles.filter(fileEntry => !!fileEntry.path);
}

function normalizeAppFilePath(path: string, rootPrefix: string) {
  const trimmed = rootPrefix && path.startsWith(rootPrefix)
    ? path.slice(rootPrefix.length)
    : path;
  return trimmed.replace(/^\/+/, '');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
