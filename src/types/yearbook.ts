export interface Yearbook {
  id: string;
  driveFileId?: string;
  driveFolderId?: string;
  name: string;
  title: string;
  year: number | null;
  yearLabel?: string | null;
  decade: string;
  coverImage: string | null;
  coverFileId?: string;
  pageCount: number | null;
  size: number;
  sizeFormatted: string;
  modifiedTime: string;
  isSample: boolean;
  mimeType: string;
  pdfStreamUrl?: string;
  downloadUrl?: string;
  description?: string;
  imagePages?: Array<{
    id: string;
    name: string;
    pageNumber: number;
    thumbnailLink?: string;
    streamUrl: string;
  }>;
  theme?: {
    color: string;
    accent: string;
    emboss: string;
  };
}

export interface DriveStatus {
  configured: boolean;
  hasFolderId: boolean;
  hasApiKey: boolean;
  folderId: string | null;
  activeSource: 'google_drive' | 'sample_archive';
  lastRefreshed: string;
  cacheTtlSeconds: number;
  error: string | null;
}

export interface YearbookResponse {
  source: 'google_drive' | 'sample_archive' | 'sample_archive_fallback';
  status: 'live' | 'cached' | 'demo_mode' | 'error_fallback';
  message?: string;
  yearbooks: Yearbook[];
  isEmptyDriveFolder?: boolean;
  lastRefreshed: string;
  pollIntervalSeconds: number;
  error?: string;
}

export interface TableOfContentItem {
  pageNumber: number;
  title: string;
  category: string;
}
