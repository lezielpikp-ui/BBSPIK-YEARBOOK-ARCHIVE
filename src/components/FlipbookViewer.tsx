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
  BookOpen,
  Columns,
  Sparkles,
  Search,
  Eye
} from 'lucide-react';

interface FlipbookViewerProps {
  yearbook: Yearbook;
  onBack: () => void;
}

type ViewerMode = 'page' | 'spread' | 'flipbook' | 'grid';

export const FlipbookViewer: React.FC<FlipbookViewerProps> = ({ yearbook, onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookElementRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<any>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // Loaded PDF instance reference
  const pdfInstanceRef = useRef<LoadedPdf | null>(null);

  // Viewing State
  const [viewerMode, setViewerMode] = useState<ViewerMode>('page');
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-indexed
  const [totalPages, setTotalPages] = useState<number>(yearbook.pageCount || 10);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(1.406); // 738/525 ~ 1.406
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled());
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [jumpPageInput, setJumpPageInput] = useState<string>('1');

  // PDF Streaming & Progressive Rendering
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<PdfLoadProgress | null>(null);
  const [pdfPages, setPdfPages] = useState<Record<number, string>>({}); // 1-indexed high-res
  const [pdfThumbnails, setPdfThumbnails] = useState<Record<number, string>>({}); // 1-indexed low-res
  const [renderingPages, setRenderingPages] = useState<Record<number, boolean>>({});
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

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

  // Render on-demand PDF page
  const requestPageRender = useCallback(async (pageNum: number, isThumbnail = false) => {
    const pdf = pdfInstanceRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) return;

    if (isThumbnail) {
      if (pdfThumbnails[pageNum]) return;
      try {
        const thumbUrl = await pdf.getPageThumbnail(pageNum);
        setPdfThumbnails((prev) => ({ ...prev, [pageNum]: thumbUrl }));
      } catch (e) {
        console.warn(`Thumbnail render notice for page ${pageNum}:`, e);
      }
      return;
    }

    if (pdfPages[pageNum] || renderingPages[pageNum]) return;

    setRenderingPages((prev) => ({ ...prev, [pageNum]: true }));
    try {
      const dataUrl = await pdf.renderPage(pageNum, 1.8);
      setPdfPages((prev) => ({ ...prev, [pageNum]: dataUrl }));
    } catch (err) {
      console.warn(`Page render notice for page ${pageNum}:`, err);
    } finally {
      setRenderingPages((prev) => ({ ...prev, [pageNum]: false }));
    }
  }, [pdfPages, pdfThumbnails, renderingPages]);

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

          // Immediately render current page (page 1)
          try {
            const p1 = await pdf.renderPage(1, 1.8);
            if (!isCancelled) {
              setPdfPages((prev) => ({ ...prev, 1: p1 }));
              setIsLoadingPdf(false);
            }
          } catch (p1Err) {
            console.error('Failed to render page 1:', p1Err);
            if (!isCancelled) setIsLoadingPdf(false);
          }

          // Pre-render page 2 and initial thumbnails in background
          if (!isCancelled && pdf.numPages >= 2) {
            pdf.renderPage(2, 1.8).then((p2) => {
              if (!isCancelled) setPdfPages((prev) => ({ ...prev, 2: p2 }));
            });
          }

          // Preload first 8 thumbnails for the thumbnail strip
          for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
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
    }

    return () => {
      isCancelled = true;
      if (pdfInstanceRef.current) {
        pdfInstanceRef.current.destroy();
        pdfInstanceRef.current = null;
      }
    };
  }, [yearbook, retryCount]);

  // Keep surrounding pages rendered in background whenever currentPage changes
  useEffect(() => {
    const pageNum = currentPage + 1; // 1-indexed
    // Current page
    requestPageRender(pageNum);
    // Next page
    if (pageNum + 1 <= totalPages) {
      requestPageRender(pageNum + 1);
    }
    // Spread mode second page
    if (viewerMode === 'spread' && pageNum + 2 <= totalPages) {
      requestPageRender(pageNum + 2);
    }
    // Previous page
    if (pageNum - 1 >= 1) {
      requestPageRender(pageNum - 1);
    }
    // Preload thumbnails around current page
    for (let p = Math.max(1, pageNum - 4); p <= Math.min(totalPages, pageNum + 6); p++) {
      requestPageRender(p, true);
    }
  }, [currentPage, totalPages, viewerMode, requestPageRender]);

  // Auto-scroll thumbnail strip to center current page
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.querySelector<HTMLElement>(`[data-thumb-page="${currentPage}"]`);
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentPage, showThumbnails]);

  // Navigation handlers
  const goToPage = useCallback((targetIndex: number) => {
    const safeTarget = Math.max(0, Math.min(totalPages - 1, targetIndex));
    setCurrentPage(safeTarget);
    if (soundActive) playPageTurnSound();
  }, [totalPages, soundActive]);

  const flipPrev = useCallback(() => {
    if (currentPage > 0) {
      const step = viewerMode === 'spread' ? 2 : 1;
      goToPage(Math.max(0, currentPage - step));
    }
  }, [currentPage, viewerMode, goToPage]);

  const flipNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      const step = viewerMode === 'spread' ? 2 : 1;
      goToPage(Math.min(totalPages - 1, currentPage + step));
    }
  }, [currentPage, totalPages, viewerMode, goToPage]);

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
        goToPage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(totalPages - 1);
      } else if (e.key === 'Escape') {
        if (isTocOpen) setIsTocOpen(false);
        if (viewerMode === 'grid') setViewerMode('page');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipNext, flipPrev, goToPage, totalPages, isTocOpen, viewerMode]);

  // Touch Swipe Handlers
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX > 0) {
        flipNext();
      } else {
        flipPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Jump input submit
  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      goToPage(parsed - 1);
    } else {
      setJumpPageInput(String(currentPage + 1));
    }
  };

  // StPageFlip effect for 3D flipbook mode only
  useEffect(() => {
    if (viewerMode !== 'flipbook') {
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.destroy();
        } catch (e) {
          // ignore
        }
        pageFlipRef.current = null;
      }
      return;
    }

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
        const isWide = window.innerWidth > 900;
        const baseWidth = isWide ? 600 : 450;
        const baseHeight = Math.round(baseWidth / pageAspectRatio);

        const pageFlip = new PageFlip(bookElementRef.current, {
          width: baseWidth,
          height: baseHeight,
          size: 'stretch',
          minWidth: 260,
          maxWidth: 1000,
          minHeight: 180,
          maxHeight: 750,
          maxShadowOpacity: 0.5,
          showCover: true,
          mobileScrollSupport: false,
          flippingTime: 650,
          usePortrait: !isWide,
          startPage: Math.min(currentPage, pages.length - 1),
          drawShadow: true,
          autoSize: true,
          swipeDistance: 25,
          clickEventForward: true,
          useMouseEvents: true,
        });

        pageFlip.loadFromHTML(pages);

        pageFlip.on('flip', (e: { data: number }) => {
          setCurrentPage(e.data);
          if (soundActive) playPageTurnSound();
        });

        pageFlipRef.current = pageFlip;
      } catch (err) {
        console.warn('PageFlip init notice:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [viewerMode, pageAspectRatio]);

  // Synchronize PageFlip instance when currentPage changed externally in flipbook mode
  useEffect(() => {
    if (viewerMode === 'flipbook' && pageFlipRef.current) {
      try {
        if (pageFlipRef.current.getCurrentPageIndex() !== currentPage) {
          pageFlipRef.current.turnToPage(currentPage);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [currentPage, viewerMode]);

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
              <span>{yearbook.sizeFormatted}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-900/50 text-amber-300 font-mono text-[9px] border border-amber-700/30 hidden md:inline">
                Landscape Mode
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Selector */}
        <div className="hidden lg:flex items-center bg-stone-900/90 rounded-xl p-1 border border-amber-900/40">
          <button
            onClick={() => setViewerMode('page')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'page'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="Single Landscape Page View"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Page View</span>
          </button>

          <button
            onClick={() => setViewerMode('spread')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'spread'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="Two-Page Landscape Spread"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>2-Page Spread</span>
          </button>

          <button
            onClick={() => setViewerMode('flipbook')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'flipbook'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="3D Flipbook Animation"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D Flip</span>
          </button>

          <button
            onClick={() => setViewerMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
              viewerMode === 'grid'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-amber-300/70 hover:text-amber-100'
            }`}
            title="Browse All Pages Grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Browse All</span>
          </button>
        </div>

        {/* Right Tools: TOC, Thumbnails, Zoom, Sound, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile Mode Switcher Dropdown */}
          <div className="lg:hidden">
            <button
              onClick={() => {
                const modes: ViewerMode[] = ['page', 'spread', 'flipbook', 'grid'];
                const nextIdx = (modes.indexOf(viewerMode) + 1) % modes.length;
                setViewerMode(modes[nextIdx]);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 border border-amber-700/40 text-amber-200 text-xs font-semibold capitalize flex items-center gap-1"
            >
              <span>{viewerMode}</span>
            </button>
          </div>

          {/* Table of contents button */}
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
            <span className="hidden xl:inline">Index</span>
          </button>

          {/* Toggle Thumbnails Strip */}
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-2 rounded-lg transition text-xs hidden md:flex items-center gap-1 ${
              showThumbnails
                ? 'text-amber-300 bg-amber-950/80'
                : 'text-amber-300/60 hover:text-amber-100 hover:bg-amber-950/40'
            }`}
            title="Toggle Landscape Page Strip"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Sound toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-lg transition ${
              soundActive
                ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-950/80'
                : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'
            }`}
            title={soundActive ? 'Page audio active' : 'Audio muted'}
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 w-full overflow-hidden flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#231e1a] via-[#161311] to-[#0c0a09] touch-pan-y"
      >
        {/* Archival Desk Mat Texture */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Orientation & Spread badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-serif font-bold uppercase tracking-wider bg-black/75 text-amber-200 border border-amber-500/30 backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {viewerMode === 'page' && `Landscape Page View • Page ${currentPage + 1} of ${totalPages}`}
            {viewerMode === 'spread' && `Landscape 2-Page Spread • Pages ${currentPage + 1}-${Math.min(currentPage + 2, totalPages)}`}
            {viewerMode === 'flipbook' && `3D Flipbook Spread • Page ${currentPage + 1}`}
            {viewerMode === 'grid' && `Browsing All ${totalPages} Landscape Plates`}
          </span>
        </div>

        {/* Loading overlay for initial buffering */}
        {isLoadingPdf && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/40 border border-amber-600/40 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
            <h3 className="font-serif font-bold text-lg text-amber-100">
              Streaming Archival Volume
            </h3>
            <p className="text-xs text-amber-300/70 max-w-sm mt-1 mb-4 leading-relaxed">
              Buffering high-resolution landscape plates from Google Drive with native Range streaming.
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

        {/* Floating Prev Button */}
        <button
          onClick={flipPrev}
          disabled={currentPage <= 0}
          className="absolute left-2 sm:left-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-black/80 border border-amber-500/40 text-amber-200 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all disabled:opacity-20 hover:scale-105 active:scale-95"
          title="Previous Page (Left Arrow or Swipe Right)"
        >
          <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>

        {/* Floating Next Button */}
        <button
          onClick={flipNext}
          disabled={currentPage >= totalPages - 1}
          className="absolute right-2 sm:right-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-black/80 border border-amber-500/40 text-amber-200 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all disabled:opacity-20 hover:scale-105 active:scale-95"
          title="Next Page (Right Arrow or Swipe Left)"
        >
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>

        {/* ============================================================== */}
        {/* MODE 1: LANDSCAPE PAGE VIEW (PRIMARY & ULTRA-CRISP BROWSING)   */}
        {/* ============================================================== */}
        {viewerMode === 'page' && (
          <div
            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
            className="relative flex items-center justify-center max-w-full max-h-full"
          >
            <div
              className="relative rounded-lg shadow-2xl overflow-hidden bg-[#fdfbf7] border-2 border-amber-500/30 transition-all flex items-center justify-center"
              style={{
                width: 'min(92vw, 1200px)',
                aspectRatio: `${pageAspectRatio.toFixed(3)}`,
                maxHeight: 'min(78vh, 850px)',
              }}
            >
              {/* If Google Drive PDF */}
              {!yearbook.isSample && yearbook.mimeType === 'application/pdf' && (
                <div className="w-full h-full relative flex items-center justify-center bg-[#faf8f5]">
                  {pdfPages[currentPage + 1] ? (
                    <img
                      src={pdfPages[currentPage + 1]}
                      alt={`Yearbook Page ${currentPage + 1}`}
                      className="w-full h-full object-contain select-none transition-opacity duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#fdfbf7]">
                      <Loader2 className="w-8 h-8 text-amber-700 animate-spin mb-3" />
                      <h4 className="font-serif font-bold text-sm text-slate-800">
                        Rendering Landscape Page {currentPage + 1}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        Streaming archival plate in high resolution...
                      </p>
                    </div>
                  )}

                  {/* Watermark / Page Number */}
                  <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-amber-200 border border-amber-500/30 pointer-events-none">
                    Plate {currentPage + 1} / {totalPages}
                  </div>
                </div>
              )}

              {/* If Image Sequence */}
              {!yearbook.isSample && yearbook.mimeType === 'collection/image-sequence' && (
                <div className="w-full h-full relative flex items-center justify-center bg-[#faf8f5]">
                  {yearbook.imagePages && yearbook.imagePages[currentPage] ? (
                    <img
                      src={yearbook.imagePages[currentPage].streamUrl}
                      alt={yearbook.imagePages[currentPage].name}
                      className="w-full h-full object-contain select-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      Page image unavailable
                    </div>
                  )}
                  <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-amber-200 border border-amber-500/30">
                    Plate {currentPage + 1} / {totalPages}
                  </div>
                </div>
              )}

              {/* If Sample Yearbook */}
              {yearbook.isSample && samplePages[currentPage] && (
                <div className="w-full h-full p-4 sm:p-8 flex flex-col justify-between overflow-y-auto">
                  <SamplePageContent page={samplePages[currentPage]} yearbook={yearbook} />
                  <div className="pt-2 border-t border-amber-900/10 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Bina Bangsa School PIK Archival Sample</span>
                    <span>Plate {currentPage + 1} of {totalPages}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: LANDSCAPE 2-PAGE SPREAD                                */}
        {/* ============================================================== */}
        {viewerMode === 'spread' && (
          <div
            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
            className="relative flex items-center justify-center max-w-full max-h-full gap-2 sm:gap-4"
          >
            {/* Left Page (currentPage + 1) */}
            <div
              className="relative rounded-lg shadow-2xl overflow-hidden bg-[#fdfbf7] border-2 border-amber-500/30 flex items-center justify-center"
              style={{
                width: 'min(46vw, 650px)',
                aspectRatio: `${pageAspectRatio.toFixed(3)}`,
                maxHeight: 'min(78vh, 800px)',
              }}
            >
              {!yearbook.isSample && yearbook.mimeType === 'application/pdf' && (
                <div className="w-full h-full relative flex items-center justify-center bg-[#faf8f5]">
                  {pdfPages[currentPage + 1] ? (
                    <img
                      src={pdfPages[currentPage + 1]}
                      alt={`Page ${currentPage + 1}`}
                      className="w-full h-full object-contain select-none"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Loader2 className="w-6 h-6 text-amber-700 animate-spin mb-2" />
                      <span className="text-xs font-serif font-bold text-slate-700">
                        Page {currentPage + 1}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-amber-200">
                    p. {currentPage + 1}
                  </div>
                </div>
              )}

              {yearbook.isSample && samplePages[currentPage] && (
                <div className="w-full h-full p-4 flex flex-col justify-between overflow-y-auto">
                  <SamplePageContent page={samplePages[currentPage]} yearbook={yearbook} />
                  <div className="pt-2 border-t border-amber-900/10 text-[10px] text-slate-400 font-mono text-left">
                    p. {currentPage + 1}
                  </div>
                </div>
              )}
            </div>

            {/* Right Page (currentPage + 2) */}
            <div
              className="relative rounded-lg shadow-2xl overflow-hidden bg-[#fdfbf7] border-2 border-amber-500/30 flex items-center justify-center"
              style={{
                width: 'min(46vw, 650px)',
                aspectRatio: `${pageAspectRatio.toFixed(3)}`,
                maxHeight: 'min(78vh, 800px)',
              }}
            >
              {currentPage + 1 < totalPages ? (
                <>
                  {!yearbook.isSample && yearbook.mimeType === 'application/pdf' && (
                    <div className="w-full h-full relative flex items-center justify-center bg-[#faf8f5]">
                      {pdfPages[currentPage + 2] ? (
                        <img
                          src={pdfPages[currentPage + 2]}
                          alt={`Page ${currentPage + 2}`}
                          className="w-full h-full object-contain select-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <Loader2 className="w-6 h-6 text-amber-700 animate-spin mb-2" />
                          <span className="text-xs font-serif font-bold text-slate-700">
                            Page {currentPage + 2}
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-amber-200">
                        p. {currentPage + 2}
                      </div>
                    </div>
                  )}

                  {yearbook.isSample && samplePages[currentPage + 1] && (
                    <div className="w-full h-full p-4 flex flex-col justify-between overflow-y-auto">
                      <SamplePageContent page={samplePages[currentPage + 1]} yearbook={yearbook} />
                      <div className="pt-2 border-t border-amber-900/10 text-[10px] text-slate-400 font-mono text-right">
                        p. {currentPage + 2}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 font-serif">
                  <span className="text-sm italic">End of Volume</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 3: 3D FLIPBOOK SPREAD                                     */}
        {/* ============================================================== */}
        {viewerMode === 'flipbook' && (
          <div
            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
            className="relative max-w-full max-h-full flex items-center justify-center"
          >
            <div
              ref={bookElementRef}
              className="flipbook-root shadow-2xl relative cursor-grab active:cursor-grabbing"
              style={{
                width: 'min(94vw, 1260px)',
                aspectRatio: `${(pageAspectRatio * 2).toFixed(3)}`,
                maxHeight: 'min(78vh, 750px)',
              }}
            >
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

              {/* Drive PDF Pages */}
              {!yearbook.isSample &&
                yearbook.mimeType === 'application/pdf' &&
                Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <div
                      key={pNum}
                      className="flipbook-page bg-[#fdfbf7] text-slate-800 overflow-hidden relative"
                      data-density={idx === 0 || idx === totalPages - 1 ? 'hard' : 'soft'}
                    >
                      {pdfPages[pNum] ? (
                        <img
                          src={pdfPages[pNum]}
                          alt={`Page ${pNum}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-amber-50/40">
                          <Loader2 className="w-6 h-6 text-amber-800 animate-spin mb-2" />
                          <span className="font-serif font-bold text-xs text-amber-950">
                            Page {pNum}
                          </span>
                          <span className="text-[10px] text-slate-500">Buffering plate...</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-400">
                        {pNum}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 4: ALL PAGES LANDSCAPE GRID BROWSER                       */}
        {/* ============================================================== */}
        {viewerMode === 'grid' && (
          <div className="absolute inset-0 z-30 bg-[#141210]/95 backdrop-blur-md p-4 sm:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-900/40">
                <div>
                  <h3 className="font-serif font-bold text-lg text-amber-100">
                    Landscape Page Browser • All {totalPages} Plates
                  </h3>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Click any page to open immediately in high-resolution Landscape Page View
                  </p>
                </div>
                <button
                  onClick={() => setViewerMode('page')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Resume Page View</span>
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
                      onClick={() => {
                        goToPage(idx);
                        setViewerMode('page');
                      }}
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
                          {pNum === 1 ? 'Cover' : pNum === totalPages ? 'Back' : `Plate ${pNum}`}
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
                      goToPage(idx);
                      setIsTocOpen(false);
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
                      goToPage(idx);
                      setIsTocOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                      currentPage === idx
                        ? 'bg-amber-800 text-white font-semibold'
                        : 'hover:bg-amber-100 text-slate-700'
                    }`}
                  >
                    <span>{idx === 0 ? 'Front Cover' : idx === totalPages - 1 ? 'Back Cover' : `Landscape Plate ${idx + 1}`}</span>
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

      {/* ============================================================== */}
      {/* HORIZONTAL LANDSCAPE THUMBNAIL STRIP (FOR QUICK BROWSING)       */}
      {/* ============================================================== */}
      {showThumbnails && viewerMode !== 'grid' && (
        <div className="h-20 bg-[#12100e] border-t border-amber-900/30 px-3 py-1.5 flex items-center shrink-0 z-20">
          <div
            ref={thumbnailStripRef}
            className="w-full flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-amber-700/50 scrollbar-track-stone-900"
          >
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              const isCurrent = currentPage === idx;
              const thumb = pdfThumbnails[pNum] || pdfPages[pNum];

              return (
                <button
                  key={pNum}
                  data-thumb-page={idx}
                  onClick={() => goToPage(idx)}
                  className={`relative shrink-0 rounded-md overflow-hidden transition-all border ${
                    isCurrent
                      ? 'border-amber-400 ring-2 ring-amber-400/80 scale-105 shadow-md'
                      : 'border-amber-900/40 opacity-70 hover:opacity-100 hover:border-amber-500/60'
                  }`}
                  style={{
                    height: '56px',
                    aspectRatio: `${pageAspectRatio.toFixed(3)}`,
                  }}
                  title={`Jump to Page ${pNum}`}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Thumb ${pNum}`}
                      className="w-full h-full object-cover bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-800 flex items-center justify-center text-[9px] font-mono text-amber-200/50">
                      {pNum}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl bg-black/80 text-[8px] font-mono text-amber-200">
                    {pNum}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Controls & Page Scrubber */}
      <footer className="h-14 bg-[#0f0e0d]/95 border-t border-amber-900/30 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-lg">
        {/* Previous page button */}
        <button
          onClick={flipPrev}
          disabled={currentPage <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-700/40 text-xs font-medium transition disabled:opacity-30 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Center: Scrubber & Page Indicator & Jump Input */}
        <div className="flex-1 max-w-xl mx-3 sm:mx-6 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalPages - 1)}
            value={currentPage}
            onChange={(e) => goToPage(parseInt(e.target.value, 10))}
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
          <span className="hidden sm:inline">Next</span>
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
