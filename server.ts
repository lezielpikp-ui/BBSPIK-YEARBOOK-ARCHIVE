import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory cache for Google Drive results
interface DriveCache {
  data: any[];
  timestamp: number;
}

let driveCache: DriveCache | null = null;
const CACHE_TTL_MS = 35 * 1000; // 35 seconds (comfortably under the 45s polling cycle)
let lastDriveError: string | null = null;

// Helper to extract year from file or folder name
function extractYear(name: string): number | null {
  const norm = name.replace(/_/g, ' ');
  // Matches school year range e.g. 2024-2025 -> returns 2024
  const rangeMatch = norm.match(/(?<!\d)(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2})(?!\d)/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }

  // Matches 4-digit years between 1800 and 2099
  const match4 = norm.match(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/);
  if (match4) return parseInt(match4[1], 10);

  // Matches '24 or Class of 98
  const match2 = norm.match(/['’](\d{2})\b/);
  if (match2) {
    const yr = parseInt(match2[1], 10);
    return yr > 40 ? 1900 + yr : 2000 + yr;
  }
  return null;
}

function extractYearLabel(name: string): string | null {
  const norm = name.replace(/_/g, ' ');
  const rangeMatch = norm.match(/(?<!\d)(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2})(?!\d)/);
  if (rangeMatch) {
    return `${rangeMatch[1]}–${rangeMatch[2]}`;
  }
  const match4 = norm.match(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/);
  if (match4) return match4[1];
  return null;
}

// Clean title from filename
function cleanTitle(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/_compressed$/i, '') // remove _compressed
    .replace(/_\s*/g, ': ') // replace underscore with colon separator
    .replace(/\s+/g, ' ')
    .trim();
}

// Sample Yearbooks for showcase and when Drive credentials are not yet supplied
const SAMPLE_YEARBOOKS = [
  {
    id: 'sample-2024',
    name: 'The Centenary Beacon - 2024 Centennial Edition.pdf',
    title: 'The Centenary Beacon (Centennial Edition)',
    year: 2024,
    decade: '2020s',
    coverImage: '/sample-covers/cover-2024.svg',
    pageCount: 10,
    size: 42 * 1024 * 1024, // 42 MB
    sizeFormatted: '42.0 MB',
    modifiedTime: new Date(Date.now() - 2 * 86400000).toISOString(),
    isSample: true,
    mimeType: 'application/pdf',
    theme: {
      color: '#831843', // deep maroon / wine
      accent: '#fef08a', // gold
      emboss: 'gold-foil',
    },
    description: 'Celebrating 100 years of academic excellence, campus traditions, athletics, and the graduation class of 2024.',
  },
  {
    id: 'sample-2020',
    name: 'Echoes & Horizons - Class of 2020.pdf',
    title: 'Echoes & Horizons (Class of 2020)',
    year: 2020,
    decade: '2020s',
    coverImage: '/sample-covers/cover-2020.svg',
    pageCount: 10,
    size: 28 * 1024 * 1024,
    sizeFormatted: '28.0 MB',
    modifiedTime: new Date(Date.now() - 15 * 86400000).toISOString(),
    isSample: true,
    mimeType: 'application/pdf',
    theme: {
      color: '#0f172a', // midnight slate
      accent: '#38bdf8', // electric cyan / silver
      emboss: 'silver-foil',
    },
    description: 'A historic year of resilience, unity, virtual ceremonies, and creative triumph during uncharted times.',
  },
  {
    id: 'sample-2000',
    name: 'Millennium Odyssey 2000.pdf',
    title: 'Millennium Odyssey (Y2K Commemorative)',
    year: 2000,
    decade: '2000s',
    coverImage: '/sample-covers/cover-2000.svg',
    pageCount: 10,
    size: 35 * 1024 * 1024,
    sizeFormatted: '35.0 MB',
    modifiedTime: new Date(Date.now() - 45 * 86400000).toISOString(),
    isSample: true,
    mimeType: 'application/pdf',
    theme: {
      color: '#1e1b4b', // royal indigo
      accent: '#c084fc', // purple / iridescent
      emboss: 'holo-foil',
    },
    description: 'Crossing the threshold into the 21st century: early internet labs, student time capsules, and unforgettable graduation memories.',
  },
  {
    id: 'sample-1985',
    name: 'Golden Echoes - Yearbook 1985.pdf',
    title: 'Golden Echoes (Yearbook 1985)',
    year: 1985,
    decade: '1980s',
    coverImage: '/sample-covers/cover-1985.svg',
    pageCount: 10,
    size: 58 * 1024 * 1024,
    sizeFormatted: '58.0 MB',
    modifiedTime: new Date(Date.now() - 120 * 86400000).toISOString(),
    isSample: true,
    mimeType: 'application/pdf',
    theme: {
      color: '#064e3b', // emerald pine
      accent: '#fbbf24', // vintage warm gold
      emboss: 'gold-foil',
    },
    description: 'Neon vibrancy, varsity championship banners, analog darkroom photography, and 80s musical spectacles.',
  },
  {
    id: 'sample-1974',
    name: 'The Heritage Archive - 1974 Edition.pdf',
    title: 'The Heritage Archive (1974 Golden Jubilee)',
    year: 1974,
    decade: '1970s',
    coverImage: '/sample-covers/cover-1974.svg',
    pageCount: 10,
    size: 64 * 1024 * 1024,
    sizeFormatted: '64.0 MB',
    modifiedTime: new Date(Date.now() - 365 * 86400000).toISOString(),
    isSample: true,
    mimeType: 'application/pdf',
    theme: {
      color: '#451a03', // vintage leather brown
      accent: '#eab308', // antique gold
      emboss: 'blind-deboss',
    },
    description: 'Half-century commemorative edition bound in classic buckram leather with authentic vintage portrait galleries and signatures.',
  },
];

// Fetch files from Google Drive v3 API
async function fetchGoogleDriveFiles(folderId: string, apiKey: string) {
  // Query 1: Root folder items (PDFs, Images, and Subfolders)
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webContentLink,description)&pageSize=100&orderBy=modifiedTime desc&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rootFiles = data.files || [];

  const results: any[] = [];
  const subfolders: any[] = [];

  for (const item of rootFiles) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      subfolders.push(item);
    } else if (
      item.mimeType === 'application/pdf' ||
      item.mimeType?.startsWith('image/')
    ) {
      results.push(formatDriveItem(item, folderId));
    }
  }

  // Query 2: Subfolder items (1 level deep)
  for (const subfolder of subfolders) {
    try {
      const subQuery = `'${subfolder.id}' in parents and trashed = false`;
      const subUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        subQuery
      )}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink,iconLink,webContentLink,description)&pageSize=250&key=${apiKey}`;

      const subRes = await fetch(subUrl);
      if (subRes.ok) {
        const subData = await subRes.json();
        const subFiles = subData.files || [];

        // Check if subfolder represents a multi-image sequence yearbook (contains multiple images)
        const imageFiles = subFiles.filter((f: any) =>
          f.mimeType?.startsWith('image/')
        );
        const pdfFiles = subFiles.filter(
          (f: any) => f.mimeType === 'application/pdf'
        );

        if (pdfFiles.length > 0) {
          for (const pdf of pdfFiles) {
            results.push(
              formatDriveItem(pdf, subfolder.id, subfolder.name)
            );
          }
        }
        
        if (imageFiles.length > 0) {
          // Natural alphanumeric sort so page-001.jpg, page-002.jpg, page-010.jpg are in exact order
          imageFiles.sort((a: any, b: any) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

          // Represent this subfolder as a numbered image-sequence yearbook
          const year = extractYear(subfolder.name);
          const yearLabel = extractYearLabel(subfolder.name);
          const totalSize = imageFiles.reduce(
            (acc: number, f: any) => acc + (parseInt(f.size || '0', 10)),
            0
          );
          const firstImageCover = imageFiles[0]?.thumbnailLink
            ? imageFiles[0].thumbnailLink.replace(/=s\d+$/, '=s800')
            : `/api/drive/stream/${imageFiles[0]?.id}`;

          results.push({
            id: `folder-${subfolder.id}`,
            driveFolderId: subfolder.id,
            name: subfolder.name,
            title: cleanTitle(subfolder.name),
            year: year,
            yearLabel: yearLabel || (year ? String(year) : null),
            decade: year ? `${Math.floor(year / 10) * 10}s` : 'Archive',
            coverImage: firstImageCover,
            coverFileId: imageFiles[0]?.id,
            pageCount: imageFiles.length,
            size: totalSize,
            sizeFormatted: formatBytes(totalSize),
            modifiedTime: subfolder.modifiedTime || new Date().toISOString(),
            isSample: false,
            mimeType: 'collection/image-sequence',
            imagePages: imageFiles.map((img: any, idx: number) => ({
              id: img.id,
              name: img.name,
              pageNumber: idx + 1,
              thumbnailLink: img.thumbnailLink ? img.thumbnailLink.replace(/=s\d+$/, '=s300') : null,
              streamUrl: `/api/drive/stream/${img.id}`,
            })),
            description: `Digitized yearbook image collection containing ${imageFiles.length} sequenced plates (${imageFiles[0]?.name} to ${imageFiles[imageFiles.length - 1]?.name}).`,
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to inspect subfolder ${subfolder.id}:`, err);
    }
  }

  // Sort: year descending if available, else modifiedTime descending
  results.sort((a, b) => {
    if (a.year && b.year) return b.year - a.year;
    if (a.year) return -1;
    if (b.year) return 1;
    return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
  });

  return results;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFolderId(): string | undefined {
  return (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER)?.trim();
}

function getApiKey(): string | undefined {
  return process.env.GOOGLE_DRIVE_API_KEY?.trim();
}

function formatDriveItem(item: any, parentFolderId: string, folderName?: string) {
  const sizeNum = parseInt(item.size || '0', 10);
  const year = extractYear(item.name) || (folderName ? extractYear(folderName) : null);
  const yearLabel = extractYearLabel(item.name) || (folderName ? extractYearLabel(folderName) : (year ? String(year) : null));
  const title = cleanTitle(item.name);

  // High-res Drive thumbnail URL
  let coverUrl = item.thumbnailLink;
  if (coverUrl) {
    coverUrl = coverUrl.replace(/=s\d+$/, '=s800');
  }

  return {
    id: item.id,
    driveFileId: item.id,
    name: item.name,
    title: folderName ? `${cleanTitle(folderName)} - ${title}` : title,
    year: year,
    yearLabel: yearLabel,
    decade: year ? `${Math.floor(year / 10) * 10}s` : 'Archive',
    coverImage: coverUrl,
    pageCount: item.mimeType === 'application/pdf' ? null : 1, // PDF page count is determined dynamically by viewer
    size: sizeNum,
    sizeFormatted: formatBytes(sizeNum),
    modifiedTime: item.modifiedTime || new Date().toISOString(),
    isSample: false,
    mimeType: item.mimeType,
    pdfStreamUrl: `/api/drive/stream/${item.id}`,
    downloadUrl: item.webContentLink,
    description: item.description || `Original archive file (${formatBytes(sizeNum)}) digitized directly from Google Drive.`,
  };
}

// ================= API ROUTES =================

// 1. Status / Diagnostics
app.get('/api/status', async (req: Request, res: Response) => {
  const folderId = getFolderId();
  const apiKey = getApiKey();

  const isConfigured = Boolean(folderId && apiKey);

  res.json({
    configured: isConfigured,
    hasFolderId: Boolean(folderId),
    hasApiKey: Boolean(apiKey),
    folderId: folderId ? `${folderId.slice(0, 6)}...${folderId.slice(-4)}` : null,
    activeSource: isConfigured && !lastDriveError ? 'google_drive' : 'sample_archive',
    lastRefreshed: driveCache ? new Date(driveCache.timestamp).toISOString() : new Date().toISOString(),
    cacheTtlSeconds: Math.round(CACHE_TTL_MS / 1000),
    error: lastDriveError,
  });
});

// 2. List Yearbooks (with short-lived cache and ?refresh=true support)
app.get('/api/yearbooks', async (req: Request, res: Response) => {
  const folderId = getFolderId();
  const apiKey = getApiKey();
  const forceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';

  // If Drive credentials not supplied, return sample yearbooks with rich content
  if (!folderId || !apiKey) {
    return res.json({
      source: 'sample_archive',
      status: 'demo_mode',
      message: 'Running in Showcase Archive mode. Provide GOOGLE_DRIVE_FOLDER_ID & GOOGLE_DRIVE_API_KEY in secrets to sync your public Drive folder.',
      yearbooks: SAMPLE_YEARBOOKS,
      lastRefreshed: new Date().toISOString(),
      pollIntervalSeconds: 45,
    });
  }

  // Check in-memory cache
  const now = Date.now();
  if (!forceRefresh && driveCache && now - driveCache.timestamp < CACHE_TTL_MS) {
    return res.json({
      source: 'google_drive',
      status: 'cached',
      yearbooks: driveCache.data,
      lastRefreshed: new Date(driveCache.timestamp).toISOString(),
      pollIntervalSeconds: 45,
    });
  }

  // Fetch from Google Drive API
  try {
    const driveItems = await fetchGoogleDriveFiles(folderId, apiKey);
    driveCache = {
      data: driveItems,
      timestamp: now,
    };
    lastDriveError = null;

    // Proactively pre-cache PDFs in the background for zero-latency page flips
    backgroundPrecache(driveItems, apiKey);

    return res.json({
      source: 'google_drive',
      status: 'live',
      yearbooks: driveItems.length > 0 ? driveItems : SAMPLE_YEARBOOKS, // Fallback if folder empty
      isEmptyDriveFolder: driveItems.length === 0,
      lastRefreshed: new Date().toISOString(),
      pollIntervalSeconds: 45,
    });
  } catch (err: any) {
    console.error('Error fetching Google Drive folder:', err.message);
    lastDriveError = err.message;

    // Gracefully fallback to sample yearbooks so UI never breaks
    return res.json({
      source: 'sample_archive_fallback',
      status: 'error_fallback',
      error: err.message,
      message: 'Failed to access Google Drive folder. Serving showcase yearbooks. Verify that the folder is shared as "Anyone with link" and API key has Google Drive API enabled.',
      yearbooks: SAMPLE_YEARBOOKS,
      lastRefreshed: new Date().toISOString(),
      pollIntervalSeconds: 45,
    });
  }
});

// 3. Get single yearbook metadata
app.get('/api/yearbook/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check sample
  const sample = SAMPLE_YEARBOOKS.find((y) => y.id === id);
  if (sample) {
    return res.json(sample);
  }

  // Check cache
  if (driveCache) {
    const found = driveCache.data.find((y) => y.id === id);
    if (found) return res.json(found);
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  if (!apiKey) {
    return res.status(404).json({ error: 'Yearbook not found' });
  }

  try {
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,size,modifiedTime,thumbnailLink,description&key=${apiKey}`
    );
    if (!fileRes.ok) throw new Error('File not found in Drive');
    const data = await fileRes.json();
    return res.json(formatDriveItem(data, ''));
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Server disk cache for high-speed streaming and PDF.js range requests
const DISK_CACHE_DIR = path.resolve('/tmp/drive-cache');
if (!fs.existsSync(DISK_CACHE_DIR)) {
  fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
}

const activeDownloads = new Map<string, Promise<string>>();

async function ensureFileCached(fileId: string, apiKey: string): Promise<string> {
  const cachedPath = path.join(DISK_CACHE_DIR, `${fileId}.pdf`);
  if (fs.existsSync(cachedPath)) {
    return cachedPath;
  }
  if (activeDownloads.has(fileId)) {
    return activeDownloads.get(fileId)!;
  }

  const downloadPromise = (async () => {
    const tempPath = path.join(DISK_CACHE_DIR, `${fileId}.${Date.now()}.tmp`);
    try {
      const driveMediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
      const driveRes = await fetch(driveMediaUrl);
      if (!driveRes.ok) {
        throw new Error(`Drive responded with HTTP ${driveRes.status}: ${driveRes.statusText}`);
      }
      if (!driveRes.body) throw new Error('No response body from Google Drive');

      const fileStream = fs.createWriteStream(tempPath);
      const nodeStream = Readable.fromWeb(driveRes.body as any);
      await new Promise<void>((resolve, reject) => {
        nodeStream.pipe(fileStream);
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
        nodeStream.on('error', reject);
      });

      fs.renameSync(tempPath, cachedPath);
      return cachedPath;
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
      }
      throw err;
    } finally {
      activeDownloads.delete(fileId);
    }
  })();

  activeDownloads.set(fileId, downloadPromise);
  return downloadPromise;
}

// Helper to pre-cache yearbooks in the background so opening a book is instantaneous
function backgroundPrecache(items: any[], apiKey: string) {
  for (const item of items) {
    if (item.mimeType === 'application/pdf' && item.driveFileId) {
      ensureFileCached(item.driveFileId, apiKey).catch((e) => {
        console.warn(`Background precache notice for ${item.name}:`, e.message);
      });
    }
  }
}

// 4. Same-origin PDF.js Worker endpoint (resolves all cross-origin worker and CSP security errors)
app.get(['/pdf.worker.min.mjs', '/pdf.worker.mjs'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const workerFile = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  if (fs.existsSync(workerFile)) {
    return res.sendFile(workerFile);
  }
  const altWorker = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs');
  return res.sendFile(altWorker);
});

// 5. Drive stream proxy with full HTTP Range request support and local cache acceleration
app.get('/api/drive/stream/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();

  // Set permissive CORS and Range headers for PDF.js Web Worker access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Google Drive API Key not configured' });
  }

  try {
    const cachedFilePath = await ensureFileCached(fileId, apiKey);
    
    // Express sendFile natively handles HTTP Range (206 Partial Content),
    // Content-Range, Accept-Ranges, and HEAD requests with 0ms disk seek.
    res.sendFile(cachedFilePath, {
      acceptRanges: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (err: any) {
    console.error('Error streaming Drive file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file from Google Drive', details: err.message });
    }
  }
});

// Vite & Static file handling
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yearbook Archive server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
