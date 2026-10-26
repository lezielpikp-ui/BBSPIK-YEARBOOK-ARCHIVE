import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

// Setup same-origin PDF.js worker served directly from Express
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (err) {
    console.warn('Could not set workerSrc for pdfjsLib:', err);
  }
}

export interface PdfLoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface LoadedPdf {
  pdfDoc: any;
  numPages: number;
  pageWidth: number;
  pageHeight: number;
  aspectRatio: number;
  isLandscape: boolean;
  renderPage: (pageNumber: number, scale?: number) => Promise<string>;
  getPageThumbnail: (pageNumber: number) => Promise<string>;
  destroy: () => void;
}

const pageDataUrlCache = new Map<string, string>();
const inFlightRenderPromises = new Map<string, Promise<string>>();

export async function loadPdfDocument(
  url: string,
  onProgress?: (progress: PdfLoadProgress) => void
): Promise<LoadedPdf> {
  const fullUrl = typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url;

  let pdfDoc: any = null;

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: fullUrl,
      // Enable range requests for streaming large files up to 250MB without full download
      disableRange: false,
      disableStream: false,
      rangeChunkSize: 524288, // 512KB chunks
    });

    if (onProgress) {
      loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
        const total = progressData.total || 1;
        const loaded = progressData.loaded || 0;
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        onProgress({ loaded, total, percent });
      };
    }

    pdfDoc = await loadingTask.promise;
  } catch (primaryErr) {
    console.warn('Range streaming load notice, retrying with direct stream:', primaryErr);
    // Automatic fallback for environments where Range headers are stripped by proxies
    const fallbackTask = pdfjsLib.getDocument({
      url: fullUrl,
      disableRange: true,
      disableStream: true,
    });

    if (onProgress) {
      fallbackTask.onProgress = (progressData: { loaded: number; total: number }) => {
        const total = progressData.total || 1;
        const loaded = progressData.loaded || 0;
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        onProgress({ loaded, total, percent });
      };
    }

    pdfDoc = await fallbackTask.promise;
  }
  const numPages = pdfDoc.numPages;

  let pageWidth = 738;
  let pageHeight = 525;
  let aspectRatio = 1.406;
  let isLandscape = true;

  try {
    const firstPage = await pdfDoc.getPage(1);
    const initialViewport = firstPage.getViewport({ scale: 1.0 });
    pageWidth = initialViewport.width;
    pageHeight = initialViewport.height;
    aspectRatio = pageWidth / pageHeight;
    isLandscape = aspectRatio >= 1.05;
  } catch (e) {
    console.warn('Could not read initial page dimensions:', e);
  }

  const renderPage = async (pageNumber: number, scale: number = 1.6): Promise<string> => {
    const cacheKey = `${url}-p${pageNumber}-s${scale}`;
    if (pageDataUrlCache.has(cacheKey)) {
      return pageDataUrlCache.get(cacheKey)!;
    }

    if (inFlightRenderPromises.has(cacheKey)) {
      return inFlightRenderPromises.get(cacheKey)!;
    }

    const renderPromise = (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to get 2D canvas context');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Fill paper background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        pageDataUrlCache.set(cacheKey, dataUrl);
        return dataUrl;
      } finally {
        inFlightRenderPromises.delete(cacheKey);
      }
    })();

    inFlightRenderPromises.set(cacheKey, renderPromise);
    return renderPromise;
  };

  const getPageThumbnail = async (pageNumber: number): Promise<string> => {
    return renderPage(pageNumber, 0.35);
  };

  const destroy = () => {
    try {
      pdfDoc.destroy();
    } catch (e) {
      // ignore
    }
  };

  return {
    pdfDoc,
    numPages,
    pageWidth,
    pageHeight,
    aspectRatio,
    isLandscape,
    renderPage,
    getPageThumbnail,
    destroy,
  };
}
