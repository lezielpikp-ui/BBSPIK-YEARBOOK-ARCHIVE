import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PageFlip } from 'page-flip';
import { Yearbook } from '../types/yearbook';
import { getSampleYearbookPages, SamplePageData } from '../utils/samplePages';
import { loadPdfDocument, LoadedPdf, PdfLoadProgress } from '../utils/pdfLoader';
import { playPageTurnSound, isSoundEnabled, toggleSound } from '../utils/audio';
import { LandscapePrompt } from './LandscapePrompt';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Maximize, 
  Minimize, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ListTree, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Bookmark, 
  X,
  LayoutGrid,
  Columns,
  Share2,
  Check,
  Eye,
  Sparkles
} from 'lucide-react';

interface FlipbookViewerProps {
  yearbook: Yearbook;
  onBack: () => void;
  initialPage?: number;
}

// User Requirement: Navigation should be 'spread' and 'grid' ONLY
type ViewerMode = 'spread' | 'grid';

export const FlipbookViewer: React.FC<FlipbookViewerProps> = ({ 
  yearbook, 
  onBack,
  initialPage = 0 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookElementRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<any>(null);
  const pdfInstanceRef = useRef<LoadedPdf | null>(null);

  // Viewing State - Only spread and grid
  const [viewerMode, setViewerMode] = useState<ViewerMode>('spread');
  const [currentPage, setCurrentPage] = useState<number>(initialPage); // 0-indexed
  const [totalPages, setTotalPages] = useState<number>(yearbook.pageCount || 10);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(1.406); // 738/525 ~ 1.406
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled());
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [jumpPageInput, setJumpPageInput] = useState<string>(String(initialPage + 1));
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // PDF Streaming & Progressive Rendering
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<PdfLoadProgress | null>(null);
  const [pdfPages, setPdfPages] = useState<Record<number, string>>({}); // 1-indexed high-res
  const [pdfThumbnails, setPdfThumbnails] = useState<Record<number, string>>({}); // 1-indexed low-res
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isFlipReady, setIsFlipReady] = useState<boolean>(false);

  // Sample pages if sample yearbook
  const samplePages: SamplePageData[] = useMemo(() => {
    return yearbook.isSample ? getSampleYearbookPages(yearbook) : [];
  }, [yearbook]);

  // Sync jump input with current page
  useEffect(() => {
    setJumpPageInput(String(currentPage + 1));
  }, [currentPage]);

  // Sound toggle
  const handleToggleSound = () => {
    const nextState = toggleSound();
    setSoundActive(nextState);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleZoomReset = () => setZoomLevel(1);

  // Share public link for this specific yearbook and page
  const handleShare = () => {
    const origin = window.location.origin;
    const shareUrl = `${origin}?yearbook=${encodeURIComponent(yearbook.id)}&page=${currentPage + 1}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }).catch(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    });
  };

  // Direct DOM image updater to keep StPageFlip in sync without destructive re-init
  const updatePageImageInDOM = useCallback((pageNum: number, dataUrl: string) => {
    if (!bookElementRef.current) return;
    const imgEl = bookElementRef.current.querySelector<HTMLImageElement>(`img[data-page-img="${pageNum}"]`);
    if (imgEl && imgEl.src !== dataUrl) {
      imgEl.src = dataUrl;
      imgEl.classList.remove('opacity-0');
      imgEl.classList.add('opacity-100');
    }
    const placeholder = bookElementRef.current.querySelector<HTMLElement>(`[data-loader-page="${pageNum}"]`);
    if (placeholder) {
      placeholder.style.display = 'none';
    }
  }, []);

  // Request on-demand rendering of a PDF page
  const renderPdfPage = useCallback(async (pageNum: number) => {
    const pdf = pdfInstanceRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) return;

    if (pdfPages[pageNum]) {
      updatePageImageInDOM(pageNum, pdfPages[pageNum]);
      return;
    }

    try {
      const dataUrl = await pdf.renderPage(pageNum, 1.8);
      setPdfPages((prev) => ({ ...prev, [pageNum]: dataUrl }));
      updatePageImageInDOM(pageNum, dataUrl);
    } catch (err) {
      console.warn(`Page render notice for page ${pageNum}:`, err);
    }
  }, [pdfPages, updatePageImageInDOM]);

  // Request thumbnail for Grid mode
  const renderThumbnail = useCallback(async (pageNum: number) => {
    const pdf = pdfInstanceRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) return;
    if (pdfThumbnails[pageNum]) return;

    try {
      const thumb = await pdf.getPageThumbnail(pageNum);
      setPdfThumbnails((prev) => ({ ...prev, [pageNum]: thumb }));
    } catch (e) {
      console.warn(`Thumbnail notice for page ${pageNum}:`, e);
    }
  }, [pdfThumbnails]);

  // Load PDF if yearbook is PDF from Drive
  useEffect(() => {
    let isCancelled = false;

    if (!yearbook.isSample && yearbook.mimeType === 'application/pdf' && yearbook.pdfStreamUrl) {
      setIsLoadingPdf(true);
      setPdfError(null);

      loadPdfDocument(yearbook.pdfStreamUrl, (progress) => {
        if (!isCancelled) setPdfProgress(progress);
      })
        .then(async (pdf) => {
          if (isCancelled) return;
          pdfInstanceRef.current = pdf;
          setTotalPages(pdf.numPages);
          if (pdf.aspectRatio) {
            setPageAspectRatio(pdf.aspectRatio);
          }

          // Render first 4 pages immediately for instant initial spread viewing
          try {
            const p1 = await pdf.renderPage(1, 1.8);
            if (!isCancelled) {
              setPdfPages((prev) => ({ ...prev, 1: p1 }));
              updatePageImageInDOM(1, p1);
            }
          } catch (p1Err) {
            console.error('Failed to render page 1:', p1Err);
          }

          if (pdf.numPages >= 2) {
            try {
              const p2 = await pdf.renderPage(2, 1.8);
              if (!isCancelled) {
                setPdfPages((prev) => ({ ...prev, 2: p2 }));
                updatePageImageInDOM(2, p2);
              }
            } catch (e) {}
          }

          if (pdf.numPages >= 3) {
            pdf.renderPage(3, 1.8).then((p3) => {
              if (!isCancelled) {
                setPdfPages((prev) => ({ ...prev, 3: p3 }));
                updatePageImageInDOM(3, p3);
              }
            });
          }

          if (!isCancelled) {
            setIsLoadingPdf(false);
            setIsFlipReady(true);
          }

          // Preload initial thumbnails for Grid mode
          for (let p = 1; p <= Math.min(pdf.numPages, 12); p++) {
            if (isCancelled) break;
            pdf.getPageThumbnail(p).then((thumb) => {
              if (!isCancelled) {
                setPdfThumbnails((prev) => ({ ...prev, [p]: thumb }));
              }
            });
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('PDF Load Error:', err);
            setPdfError(err.message || 'Failed to stream PDF');
            setIsLoadingPdf(false);
          }
        });
    } else {
      setIsFlipReady(true);
    }

    return () => {
      isCancelled = true;
      if (pdfInstanceRef.current) {
        pdfInstanceRef.current.destroy();
        pdfInstanceRef.current = null;
      }
    };
  }, [yearbook, retryCount, updatePageImageInDOM]);

  // Keep adjacent pages rendered whenever currentPage changes
  useEffect(() => {
    const p = currentPage + 1;
    renderPdfPage(p);
    renderPdfPage(p + 1);
    if (p + 2 <= totalPages) renderPdfPage(p + 2);
    if (p + 3 <= totalPages) renderPdfPage(p + 3);
    if (p - 1 >= 1) renderPdfPage(p - 1);
    if (p - 2 >= 1) renderPdfPage(p - 2);
  }, [currentPage, totalPages, renderPdfPage]);

  // Initialize PageFlip instance with realistic 3D flipping animation
  useEffect(() => {
    if (viewerMode !== 'spread' || !isFlipReady) return;

    let pageFlipInstance: any = null;

    const timer = setTimeout(() => {
      if (!bookElementRef.current) return;

      const pages = bookElementRef.current.querySelectorAll<HTMLElement>('.flipbook-page');
      if (!pages || pages.length === 0) return;

      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.destroy();
        } catch (e) {
          // ignore
        }
        pageFlipRef.current = null;
      }

      try {
        const isWide = window.innerWidth > 768;
        // In landscape spread mode, each page is ~620 wide x 440 high
        const baseWidth = isWide ? 620 : 420;
        const baseHeight = Math.round(baseWidth / pageAspectRatio);

        const pageFlip = new PageFlip(bookElementRef.current, {
          width: baseWidth,
          height: baseHeight,
          size: 'stretch',
          minWidth: 280,
          maxWidth: 1100,
          minHeight: 200,
          maxHeight: 780,
          maxShadowOpacity: 0.55,
          showCover: true,
          mobileScrollSupport: false,
          flippingTime: 700, // Smooth authentic page flipping animation
          usePortrait: !isWide, // Double-page spread when screen permits
          startPage: Math.min(currentPage, pages.length - 1),
          drawShadow: true,
          autoSize: true,
          swipeDistance: 25,
          clickEventForward: true,
          useMouseEvents: true, // Enables interactive corner dragging & page peel
        });

        pageFlip.loadFromHTML(pages);

        // Flipping event: updates page and triggers turn sound
        pageFlip.on('flip', (e: { data: number }) => {
          setCurrentPage(e.data);
          if (soundActive) playPageTurnSound();
        });

        pageFlipRef.current = pageFlip;
        pageFlipInstance = pageFlip;
      } catch (err) {
        console.warn('PageFlip init notice:', err);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (pageFlipInstance) {
        try {
          pageFlipInstance.destroy();
        } catch (e) {}
      }
    };
  }, [viewerMode, isFlipReady, pageAspectRatio, yearbook]);

  // Interactive Flip Navigation Controls
  const flipNext = useCallback(() => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipNext(); // Triggers 3D flipping animation
    } else if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
      if (soundActive) playPageTurnSound();
    }
  }, [currentPage, totalPages, soundActive]);

  const flipPrev = useCallback(() => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipPrev(); // Triggers 3D flipping animation
    } else if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
      if (soundActive) playPageTurnSound();
    }
  }, [currentPage, soundActive]);

  const turnToPageAnimated = useCallback((targetIndex: number) => {
    const safeTarget = Math.max(0, Math.min(totalPages - 1, targetIndex));
    if (pageFlipRef.current) {
      pageFlipRef.current.turnToPage(safeTarget); // Triggers smooth animated turn
    } else {
      setCurrentPage(safeTarget);
      if (soundActive) playPageTurnSound();
    }
  }, [totalPages, soundActive]);

  // Select page from Grid mode -> switches to spread and flips to that page
  const handleSelectPageFromGrid = (targetIndex: number) => {
    setViewerMode('spread');
    setTimeout(() => {
      turnToPageAnimated(targetIndex);
    }, 150);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        flipNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        flipPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        turnToPageAnimated(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        turnToPageAnimated(totalPages - 1);
      } else if (e.key === 'Escape') {
        if (isTocOpen) setIsTocOpen(false);
        if (viewerMode === 'grid') setViewerMode('spread');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipNext, flipPrev, turnToPageAnimated, totalPages, isTocOpen, viewerMode]);

  // Jump input submit
  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      turnToPageAnimated(parsed - 1);
    } else {
      setJumpPageInput(String(currentPage + 1));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#161412] text-amber-50 flex flex-col select-none overflow-hidden font-sans">
      {/* Mobile Landscape Encouragement */}
      <LandscapePrompt onRequestFullscreen={toggleFullscreen} />

      {/* Top Navigation Bar */}
      <nav className="h-14 bg-[#110f0e]/95 border-b border-amber-900/30 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-md">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2.5 sm:gap-4 overflow-hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/40 text-xs font-semibold transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Archive</span>
          </button>

          <div className="p-0.5 rounded-lg bg-white/90 border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img
              src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png"
              alt="Bina Bangsa School Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="overflow-hidden">
            <h2 className="font-serif font-bold text-xs sm:text-sm text-amber-100 truncate">
              {yearbook.title}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-amber-400/80">
              <span className="text-amber-200 font-medium">Bina Bangsa School PIK</span>
              <span>•</span>
              {yearbook.year && <span>{yearbook.year} Edition</span>}
              <span>•</span>
              <span className="text-amber-300 font-mono">
                {viewerMode === 'spread' ? 'Landscape Spread Mode' : 'Landscape Grid Mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: NAVIGATION MODE SELECTOR (SPREAD & GRID ONLY) */}
        <div className="flex items-center bg-stone-900/90 rounded-xl p-1 border border-amber-900/40">
          <button
            onClick={() => setViewerMode('spread')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'spread'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="Landscape Spread Mode with Flipping Animation"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Spread View</span>
          </button>

          <button
            onClick={() => setViewerMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'grid'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="Grid Mode - Browse all landscape plates"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid View</span>
          </button>
        </div>

        {/* Right Tools: Share, Index, Zoom, Sound, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Share View-Only Link */}
          <button
            onClick={handleShare}
            className={`flex items-center gap-1 p-2 rounded-lg transition text-xs ${
              copiedShare
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/40'
            }`}
            title="Share view-only link to this page"
          >
            {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden xl:inline">{copiedShare ? 'Copied' : 'Share'}</span>
          </button>

          {/* Table of Contents */}
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`p-2 rounded-lg transition text-xs flex items-center gap-1 ${
              isTocOpen
                ? 'bg-amber-800 text-amber-100'
                : 'hover:bg-amber-950/80 text-amber-300/80 hover:text-amber-100'
            }`}
            title="Table of Contents & Index"
          >
            <ListTree className="w-4 h-4" />
            <span className="hidden md:inline">Index</span>
          </button>

          {/* Sound toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-lg transition ${
              soundActive
                ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/80'
                : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'
            }`}
            title={soundActive ? 'Paper flip sound enabled' : 'Sound muted'}
          >
            {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-stone-900/80 rounded-lg p-0.5 border border-amber-900/30">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.75}
              className="p-1.5 rounded hover:bg-amber-950/60 text-amber-300/80 disabled:opacity-30"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1.5 text-[10px] font-mono font-bold text-amber-200"
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.5}
              className="p-1.5 rounded hover:bg-amber-950/60 text-amber-300/80 disabled:opacity-30"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-amber-950/80 text-amber-300/80 hover:text-amber-100 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Main Archival Stage */}
      <main
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#231e1a] via-[#161311] to-[#0c0a09] touch-pan-y select-none"
      >
        {/* Archival Desk Mat Texture Overlay */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Viewport orientation badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider bg-black/80 text-amber-200 border border-amber-500/30 backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {viewerMode === 'spread'
              ? `Landscape Spread • Pages ${currentPage + 1}-${Math.min(currentPage + 2, totalPages)} (Flipping Animation Active)`
              : `Landscape Grid • All ${totalPages} Plates`}
          </span>
        </div>

        {/* Loading overlay for initial buffering */}
        {isLoadingPdf && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/40 border border-amber-600/40 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
            <h3 className="font-serif font-bold text-lg text-amber-100">
              Streaming Landscape Archival Volume
            </h3>
            <p className="text-xs text-amber-300/70 max-w-sm mt-1 mb-4 leading-relaxed">
              Buffering high-resolution landscape spread from Google Drive with native Range streaming.
            </p>
            {pdfProgress && (
              <div className="w-64 max-w-full">
                <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-300 transition-all duration-300"
                    style={{ width: `${pdfProgress.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-amber-400/60 font-mono mt-1">
                  <span>{pdfProgress.percent}% Buffered</span>
                  <span>Range 206 OK</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error overlay */}
        {pdfError && (
          <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md p-6 rounded-2xl bg-stone-900 border border-red-500/40 text-stone-200">
              <h3 className="font-serif font-bold text-base text-red-400 mb-2">
                Drive Streaming Notice
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">{pdfError}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setRetryCount((c) => c + 1)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition"
                >
                  Retry Loading
                </button>
                <button
                  onClick={onBack}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                >
                  Return to Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Flip Buttons (Available in Spread Mode) */}
        {viewerMode === 'spread' && (
          <>
            <button
              onClick={flipPrev}
              disabled={currentPage <= 0}
              className="absolute left-2 sm:left-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/85 border border-amber-500/40 text-amber-200 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all disabled:opacity-20 hover:scale-105 active:scale-95"
              title="Flip to Previous Page (Left Arrow or Drag Corner)"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>

            <button
              onClick={flipNext}
              disabled={currentPage >= totalPages - 1}
              className="absolute right-2 sm:right-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/55 hover:bg-black/85 border border-amber-500/40 text-amber-200 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all disabled:opacity-20 hover:scale-105 active:scale-95"
              title="Flip to Next Page (Right Arrow or Drag Corner)"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}

        {/* ============================================================== */}
        {/* MODE 1: SPREAD VIEW (WITH FLIPPING ANIMATION)                   */}
        {/* ============================================================== */}
        <div
          style={{ 
            display: viewerMode === 'spread' ? 'flex' : 'none',
            transform: `scale(${zoomLevel})`, 
            transition: 'transform 0.2s ease-out' 
          }}
          className="relative max-w-full max-h-full items-center justify-center"
        >
          <div
            ref={bookElementRef}
            className="flipbook-root shadow-2xl relative cursor-grab active:cursor-grabbing"
            style={{
              width: 'min(94vw, 1340px)',
              aspectRatio: `${(pageAspectRatio * 2).toFixed(3)}`,
              maxHeight: 'min(80vh, 760px)',
            }}
          >
            {/* Real Drive PDF Pages */}
            {!yearbook.isSample && yearbook.mimeType === 'application/pdf' &&
              Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                const hasImg = Boolean(pdfPages[pNum]);

                return (
                  <div
                    key={pNum}
                    className="flipbook-page bg-[#fdfbf7] text-slate-800 overflow-hidden relative"
                    data-density={idx === 0 || idx === totalPages - 1 ? 'hard' : 'soft'}
                  >
                    <img
                      data-page-img={pNum}
                      src={pdfPages[pNum] || ''}
                      alt={`Page ${pNum}`}
                      className={`w-full h-full object-contain ${hasImg ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                    />
                    {!hasImg && (
                      <div
                        data-loader-page={pNum}
                        className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#faf8f5]"
                      >
                        <Loader2 className="w-6 h-6 text-amber-800 animate-spin mb-2" />
                        <span className="font-serif font-bold text-xs text-amber-950">
                          Plate {pNum}
                        </span>
                        <span className="text-[10px] text-slate-500">Buffering spread...</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-400 bg-white/70 px-1.5 py-0.5 rounded shadow-2xs">
                      {pNum}
                    </div>
                  </div>
                );
              })}

            {/* Sample Yearbook Pages */}
            {yearbook.isSample &&
              samplePages.map((page, idx) => (
                <div
                  key={idx}
                  className="flipbook-page bg-[#fdfbf7] text-slate-800 overflow-hidden relative"
                  data-density={idx === 0 || idx === samplePages.length - 1 ? 'hard' : 'soft'}
                >
                  <div className="absolute inset-0 p-5 flex flex-col justify-between overflow-y-auto">
                    <SamplePageContent page={page} yearbook={yearbook} />
                  </div>
                </div>
              ))}

            {/* Image Sequence Pages */}
            {!yearbook.isSample && yearbook.mimeType === 'collection/image-sequence' &&
              yearbook.imagePages?.map((imgPage, idx) => (
                <div
                  key={imgPage.id}
                  className="flipbook-page bg-[#fdfbf7] text-slate-800 overflow-hidden relative"
                  data-density={idx === 0 || idx === yearbook.imagePages!.length - 1 ? 'hard' : 'soft'}
                >
                  <img
                    src={imgPage.streamUrl}
                    alt={imgPage.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-500 bg-white/70 px-1.5 py-0.5 rounded">
                    Plate {imgPage.pageNumber}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* MODE 2: GRID VIEW (BROWSE ALL LANDSCAPE PLATES)                */}
        {/* ============================================================== */}
        {viewerMode === 'grid' && (
          <div className="absolute inset-0 z-30 bg-[#141210]/95 backdrop-blur-md p-4 sm:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-900/40">
                <div>
                  <h3 className="font-serif font-bold text-lg text-amber-100">
                    Landscape Plate Grid • All {totalPages} Pages
                  </h3>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Click any plate to open in Spread Mode with realistic 3D flipping animation
                  </p>
                </div>
                <button
                  onClick={() => setViewerMode('spread')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-2"
                >
                  <Columns className="w-4 h-4" />
                  <span>Resume Spread View</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = currentPage === idx;
                  const thumb = pdfThumbnails[pNum] || pdfPages[pNum];

                  return (
                    <button
                      key={pNum}
                      onClick={() => handleSelectPageFromGrid(idx)}
                      onMouseEnter={() => renderThumbnail(pNum)}
                      className={`group relative flex flex-col rounded-xl overflow-hidden transition-all text-left border ${
                        isCurrent
                          ? 'border-amber-400 ring-2 ring-amber-400/50 scale-[1.02] shadow-xl'
                          : 'border-amber-900/30 hover:border-amber-500/50 hover:scale-[1.01]'
                      } bg-stone-900/80`}
                    >
                      <div
                        className="w-full bg-[#fdfbf7] flex items-center justify-center relative overflow-hidden"
                        style={{ aspectRatio: `${pageAspectRatio.toFixed(3)}` }}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={`Plate ${pNum}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800/60 p-2 text-center">
                            <Loader2 className="w-4 h-4 text-amber-400/60 animate-spin mb-1" />
                            <span className="text-[10px] text-amber-200/50 font-mono">
                              p. {pNum}
                            </span>
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/75 text-amber-200 border border-amber-500/30">
                          #{pNum}
                        </span>
                      </div>
                      <div className="p-2 flex items-center justify-between text-[11px] bg-[#1a1715]">
                        <span className="font-serif text-amber-100 truncate">
                          {pNum === 1 ? 'Front Cover' : pNum === totalPages ? 'Back Cover' : `Plate ${pNum}`}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] uppercase font-bold text-amber-400 font-mono">
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Table of Contents Drawer */}
        {isTocOpen && (
          <div className="absolute top-4 left-4 z-40 w-72 max-w-[85vw] max-h-[80vh] rounded-2xl bg-[#fdfbf7] text-slate-800 p-4 shadow-2xl border border-amber-300 animate-in slide-in-from-left duration-200 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-800" />
                <h3 className="font-serif font-bold text-sm text-slate-900">Contents &amp; Index</h3>
              </div>
              <button
                onClick={() => setIsTocOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1 text-xs">
              {yearbook.isSample ? (
                samplePages.map((sp, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      turnToPageAnimated(idx);
                      setIsTocOpen(false);
                      if (viewerMode === 'grid') setViewerMode('spread');
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                      currentPage === idx
                        ? 'bg-amber-800 text-white font-semibold'
                        : 'hover:bg-amber-100 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{sp.title}</span>
                    <span className="font-mono text-[10px] opacity-75 shrink-0 ml-2">
                      p. {sp.pageNumber}
                    </span>
                  </button>
                ))
              ) : (
                Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      turnToPageAnimated(idx);
                      setIsTocOpen(false);
                      if (viewerMode === 'grid') setViewerMode('spread');
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                      currentPage === idx
                        ? 'bg-amber-800 text-white font-semibold'
                        : 'hover:bg-amber-100 text-slate-700'
                    }`}
                  >
                    <span>{idx === 0 ? 'Front Cover' : idx === totalPages - 1 ? 'Back Cover' : `Plate ${idx + 1}`}</span>
                    <span className="font-mono text-[10px] opacity-75 shrink-0 ml-2">
                      p. {idx + 1}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Controls & Page Scrubber with Animated Flip */}
      <footer className="h-14 bg-[#0f0e0d]/95 border-t border-amber-900/30 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-lg">
        {/* Previous page button */}
        <button
          onClick={flipPrev}
          disabled={currentPage <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/40 text-xs font-medium transition disabled:opacity-30 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Flip Prev</span>
        </button>

        {/* Center: Scrubber & Page Indicator & Jump Input */}
        <div className="flex-1 max-w-xl mx-3 sm:mx-6 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalPages - 1)}
            value={currentPage}
            onChange={(e) => turnToPageAnimated(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
          />

          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-amber-300/70 font-serif hidden sm:inline">Page</span>
            <input
              type="text"
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              className="w-10 sm:w-12 h-6 px-1 text-center font-mono text-xs bg-stone-900 border border-amber-700/50 rounded text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
            <span className="text-stone-500 text-xs font-mono">/ {totalPages}</span>
          </form>
        </div>

        {/* Next page button */}
        <button
          onClick={flipNext}
          disabled={currentPage >= totalPages - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/40 text-xs font-medium transition disabled:opacity-30 shrink-0"
        >
          <span className="hidden sm:inline">Flip Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};

// =========================================================================
// HELPER COMPONENT: RENDER SAMPLE YEARBOOK PAGE IN ARCHIVAL LANDSCAPE
// =========================================================================
const SamplePageContent: React.FC<{ page: SamplePageData; yearbook: Yearbook }> = ({ page, yearbook }) => {
  if (page.renderType === 'cover') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-amber-950 via-slate-900 to-amber-950 rounded-lg text-amber-200 border-2 border-amber-500/40 relative overflow-hidden">
        {yearbook.coverImage && (
          <img
            src={yearbook.coverImage}
            alt={yearbook.title}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        )}
        <div className="relative z-10 p-6 bg-black/65 rounded-xl border border-amber-400/40 backdrop-blur-xs max-w-lg">
          <span className="text-xs uppercase font-serif tracking-widest text-amber-300 block mb-2">
            {page.content.motto}
          </span>
          <h1 className="font-serif font-black text-2xl sm:text-4xl text-amber-100 mb-2">
            {yearbook.title}
          </h1>
          <div className="text-3xl sm:text-4xl font-serif font-black text-amber-400 my-3">
            {page.content.year}
          </div>
          <span className="text-xs font-serif text-amber-200/80 italic block">
            {page.content.edition}
          </span>
        </div>
      </div>
    );
  }

  if (page.renderType === 'principal') {
    return (
      <div className="h-full flex flex-col justify-between font-serif">
        <div className="border-b border-amber-900/20 pb-3">
          <span className="text-[10px] uppercase tracking-widest text-amber-800 font-bold">
            Foreword &amp; Dedication
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            {page.title}
          </h2>
          <p className="text-xs text-amber-900/70 italic">{page.subtitle}</p>
        </div>

        <div className="my-auto space-y-3 py-3 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
          <blockquote className="p-3 bg-amber-50/80 border-l-4 border-amber-800 rounded-r-lg italic text-amber-950">
            {page.content.quote}
          </blockquote>
          {page.content.text.map((p: string, pIdx: number) => (
            <p key={pIdx}>{p}</p>
          ))}
        </div>

        <div className="pt-2 border-t border-amber-900/20 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-900 block">{page.content.principalName}</span>
            <span className="text-[11px] text-slate-500">Head of School</span>
          </div>
          <span className="font-serif italic text-slate-400">{page.content.signatureDate}</span>
        </div>
      </div>
    );
  }

  if (page.renderType === 'portraits') {
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="border-b border-amber-900/20 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-amber-800 font-bold">
            Class Gallery
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-900">{page.title}</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 my-auto py-2">
          {page.content.students.map((student: any, sIdx: number) => (
            <div
              key={sIdx}
              className="p-2.5 rounded-lg bg-white border border-amber-900/10 shadow-2xs flex flex-col justify-between text-left"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-serif font-bold text-[11px] text-white shrink-0"
                  style={{ backgroundColor: student.color }}
                >
                  {student.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-serif font-bold text-xs text-slate-900 truncate">
                    {student.name}
                  </h4>
                  <span className="text-[9px] text-amber-800 font-semibold block truncate">
                    {student.role}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 italic line-clamp-2 mb-1">
                {student.quote}
              </p>
              <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                <span className="font-medium text-amber-900/80">{student.superlative}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 text-center font-serif">
          Class of {yearbook.year} Senior Directory
        </div>
      </div>
    );
  }

  if (page.renderType === 'athletics') {
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="border-b border-amber-900/20 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-amber-800 font-bold">
            Athletics
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-900">{page.title}</h2>
          <p className="text-xs text-slate-600 italic">{page.subtitle}</p>
        </div>

        <div className="my-auto py-3 space-y-3">
          <div className="p-3 bg-amber-900/10 rounded-xl border border-amber-900/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-900 block">
                Overall Varsity Record
              </span>
              <span className="font-serif font-black text-xl text-amber-950">
                {page.content.record}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-amber-800 text-white font-serif text-xs font-bold">
              State Champions
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {page.content.teams.map((team: any, tIdx: number) => (
              <div key={tIdx} className="p-2 rounded-lg bg-white border border-amber-900/10 shadow-2xs">
                <span className="font-bold text-slate-900 block">{team.name}</span>
                <span className="text-[11px] text-emerald-700 font-medium block">{team.record}</span>
                <span className="text-[10px] text-slate-500 italic block">{team.highlight}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center font-serif">
          School Spirit &amp; Athletic Triumphs
        </div>
      </div>
    );
  }

  if (page.renderType === 'arts') {
    return (
      <div className="h-full flex flex-col justify-between">
        <div className="border-b border-amber-900/20 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-amber-800 font-bold">
            Fine &amp; Performing Arts
          </span>
          <h2 className="text-lg font-serif font-bold text-slate-900">{page.title}</h2>
        </div>

        <div className="my-auto py-3 space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 block">
              Headline Production
            </span>
            <h3 className="text-xl font-serif font-bold text-slate-900 mt-1">
              {page.content.production}
            </h3>
            <p className="text-slate-600 mt-2 italic font-serif leading-relaxed">
              {page.content.critique}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white border border-slate-200">
            <span className="font-semibold text-slate-800 block">{page.content.awards}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{page.content.director}</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center font-serif">
          Auditorium &amp; Gallery Archive
        </div>
      </div>
    );
  }

  if (page.renderType === 'back') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-amber-950 via-slate-900 to-amber-950 rounded-lg text-amber-200 border-2 border-amber-500/40 font-serif">
        <div className="w-16 h-16 rounded-full border-2 border-amber-400/50 flex items-center justify-center text-2xl font-black mb-4 text-amber-300">
          ★
        </div>
        <h2 className="font-bold text-lg text-amber-100">{page.content.publisher}</h2>
        <p className="text-xs text-amber-300/80 italic mt-2 max-w-xs">{page.content.motto}</p>
        <div className="mt-6 pt-4 border-t border-amber-500/30 text-[10px] text-amber-200/60 font-mono">
          {page.content.colophon}
        </div>
      </div>
    );
  }

  // Fallback inner page
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="border-b border-amber-900/20 pb-2">
        <h2 className="text-lg font-serif font-bold text-slate-900">{page.title}</h2>
        {page.subtitle && <p className="text-xs text-slate-500 italic">{page.subtitle}</p>}
      </div>
      <div className="my-auto py-4 text-xs text-slate-600 leading-relaxed font-serif">
        {page.content?.text ? (
          Array.isArray(page.content.text) ? (
            page.content.text.map((t: string, i: number) => <p key={i} className="mb-2">{t}</p>)
          ) : (
            <p>{page.content.text}</p>
          )
        ) : (
          <p className="italic text-slate-400">Class of {yearbook.year} archival plate</p>
        )}
      </div>
      <div className="text-[10px] text-slate-400 text-center font-serif">
        {page.category || 'Bina Bangsa School Archive'}
      </div>
    </div>
  );
};
