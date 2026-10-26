/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Yearbook, DriveStatus, YearbookResponse } from './types/yearbook';
import { Header } from './components/Header';
import { YearbookCard } from './components/YearbookCard';
import { BookshelfView } from './components/BookshelfView';
import { FlipbookViewer } from './components/FlipbookViewer';
import { DriveStatusModal } from './components/DriveStatusModal';
import { AdminModal } from './components/AdminModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { isSoundEnabled, toggleSound } from './utils/audio';
import { 
  BookOpen, 
  Sparkles, 
  Search, 
  AlertCircle, 
  Loader2, 
  Library, 
  Calendar, 
  Layers, 
  RefreshCw, 
  X,
  Share2,
  ShieldCheck,
  Check,
  Lock,
  Eye,
  FolderSync
} from 'lucide-react';

const POLL_INTERVAL_SECONDS = 45;

export default function App() {
  const [yearbooks, setYearbooks] = useState<Yearbook[]>([]);
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [selectedYearbook, setSelectedYearbook] = useState<Yearbook | null>(null);
  const [initialViewerPage, setInitialViewerPage] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Access State (View-Only by default for visitors, admin for authorized school manager)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('bbs_admin_session') === 'true' ||
        new URLSearchParams(window.location.search).get('admin') === 'true'
      );
    }
    return false;
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [copiedPublicToast, setCopiedPublicToast] = useState<boolean>(false);

  // Background 45s poll toast notification state (Shown only to Admin)
  const [pendingNewYearbooks, setPendingNewYearbooks] = useState<Yearbook[] | null>(null);
  const [showUpdateToast, setShowUpdateToast] = useState<boolean>(false);

  // Filters & display
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('year-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'shelf'>('grid');
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled());
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);

  // Polling countdown tracker
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState<number>(POLL_INTERVAL_SECONDS);

  // Sound handler
  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundActive(next);
  };

  // Admin Authentication handlers
  const handleAdminLogin = (email: string, pass: string): boolean => {
    const cleanEmail = email.toLowerCase().trim();
    if (
      cleanEmail === 'leziel.pikp@binabangsaschool.com' ||
      pass === 'bbsadmin' ||
      pass === 'admin2026' ||
      pass === 'binabangsa'
    ) {
      setIsAdmin(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bbs_admin_session', 'true');
      }
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bbs_admin_session');
    }
  };

  // Share Public View-Only Link
  const handleShareArchive = () => {
    const publicUrl = window.location.origin;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedPublicToast(true);
      setTimeout(() => setCopiedPublicToast(false), 3000);
    }).catch(() => {
      setCopiedPublicToast(true);
      setTimeout(() => setCopiedPublicToast(false), 3000);
    });
  };

  // Fetch yearbooks & status from backend
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    try {
      // 1. Fetch Yearbooks (supports ?refresh=true)
      const res = await fetch(`/api/yearbooks${isManualRefresh ? '?refresh=true' : ''}`, {
        headers: isManualRefresh ? { 'Cache-Control': 'no-cache' } : {},
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: YearbookResponse = await res.json();
      const incoming: Yearbook[] = data.yearbooks || [];

      // Check if background poll detected new or modified files
      if (!isManualRefresh && yearbooks.length > 0) {
        const hasDiff =
          incoming.length !== yearbooks.length ||
          incoming.some((inc) => {
            const cur = yearbooks.find((y) => y.id === inc.id);
            return !cur || cur.modifiedTime !== inc.modifiedTime || cur.name !== inc.name;
          });

        if (hasDiff && isAdmin) {
          setPendingNewYearbooks(incoming);
          setShowUpdateToast(true);
        } else if (!hasDiff) {
          setYearbooks(incoming);
        }
      } else {
        // Initial load or user-triggered manual refresh: apply immediately
        setYearbooks(incoming);
        setPendingNewYearbooks(null);
        setShowUpdateToast(false);
      }

      // 2. Fetch Drive Diagnostics Status
      const statusRes = await fetch('/api/status');
      if (statusRes.ok) {
        const sData: DriveStatus = await statusRes.json();
        setDriveStatus(sData);
      }
      setError(null);
    } catch (err: any) {
      console.error('Failed to sync yearbook archive:', err);
      setError(err.message || 'Failed to sync with archive');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setSecondsUntilNextPoll(POLL_INTERVAL_SECONDS);
    }
  }, [yearbooks, isAdmin]);

  // Apply pending updates from the toast (admin only)
  const handleApplyUpdateToast = () => {
    if (pendingNewYearbooks) {
      setYearbooks(pendingNewYearbooks);
    } else {
      fetchData(true);
    }
    setShowUpdateToast(false);
    setPendingNewYearbooks(null);
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deep Link: inspect URL query params (?yearbook=...&page=...)
  useEffect(() => {
    if (yearbooks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('yearbook');
    const targetPage = params.get('page');

    if (targetId) {
      const match = yearbooks.find((y) => y.id === targetId || y.driveFileId === targetId);
      if (match) {
        setSelectedYearbook(match);
        if (targetPage) {
          const parsed = parseInt(targetPage, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            setInitialViewerPage(parsed - 1);
          }
        }
      }
    }
  }, [yearbooks]);

  // Automatic Polling every 45 seconds + Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          fetchData();
          return POLL_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchData]);

  // Compute available decades for filter
  const decades = useMemo(() => {
    const set = new Set<string>();
    yearbooks.forEach((y) => {
      if (y.decade && y.decade !== 'Unknown') {
        set.add(y.decade);
      }
    });
    return Array.from(set).sort().reverse();
  }, [yearbooks]);

  // Filter & Sort
  const filteredYearbooks = useMemo(() => {
    return yearbooks
      .filter((yb) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = yb.title.toLowerCase().includes(q);
          const matchName = yb.name.toLowerCase().includes(q);
          const matchYear = yb.year ? String(yb.year).includes(q) : false;
          if (!matchTitle && !matchName && !matchYear) return false;
        }
        if (selectedDecade !== 'all') {
          if (yb.decade !== selectedDecade) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'year-desc') {
          return (b.year || 0) - (a.year || 0);
        }
        if (sortBy === 'year-asc') {
          return (a.year || 0) - (b.year || 0);
        }
        if (sortBy === 'title-asc') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'updated-desc') {
          return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
        }
        return 0;
      });
  }, [yearbooks, searchQuery, selectedDecade, sortBy]);

  // If a yearbook is currently being read, show FlipbookViewer in Landscape Spread/Grid
  if (selectedYearbook) {
    return (
      <FlipbookViewer
        yearbook={selectedYearbook}
        initialPage={initialViewerPage}
        onBack={() => {
          setSelectedYearbook(null);
          setInitialViewerPage(0);
          // Clean query params on back
          if (window.history.pushState) {
            window.history.pushState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-slate-800 flex flex-col font-sans">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* Floating Public Link Copied Confirmation Toast */}
      {copiedPublicToast && (
        <div className="fixed top-18 right-4 sm:right-6 z-50 flex items-center gap-2.5 py-2.5 px-4 rounded-2xl bg-emerald-950/95 text-emerald-100 border border-emerald-500/50 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 duration-300">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-serif font-bold text-emerald-200">
            Public View-Only Link copied to clipboard!
          </span>
        </div>
      )}

      {/* Admin-only: New Yearbooks Available in Drive Toast */}
      {isAdmin && showUpdateToast && (
        <div className="fixed top-18 right-4 sm:right-6 z-50 flex items-center gap-3 py-2.5 px-4 rounded-2xl bg-amber-950/95 text-amber-100 border border-amber-500/50 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-serif font-bold text-amber-200">
              New updates detected in Google Drive
            </span>
          </div>

          <button
            onClick={handleApplyUpdateToast}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-800 hover:bg-amber-700 text-amber-50 text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Apply Sync</span>
          </button>

          <button
            onClick={() => setShowUpdateToast(false)}
            className="p-1 text-amber-400/70 hover:text-amber-200 transition"
            title="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header with Search, Filter, Sort, Sound & Admin/Share */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDecade={selectedDecade}
        onDecadeChange={setSelectedDecade}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        soundEnabled={soundActive}
        onToggleSound={handleToggleSound}
        isAdmin={isAdmin}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onShareArchive={handleShareArchive}
        decades={decades}
        driveStatus={driveStatus}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onForceRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Public View-Only Notice / Admin Mode Status Banner */}
        <div className="mb-6 p-3.5 rounded-2xl bg-amber-100/60 border border-amber-300/80 text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-amber-800 text-white font-mono font-bold text-[10px] tracking-wider uppercase shrink-0">
              {isAdmin ? 'Admin Mode' : 'Public Viewer'}
            </span>
            <p className="text-amber-950 text-xs leading-normal">
              {isAdmin
                ? 'Logged in as administrator (leziel.pikp@binabangsaschool.com). You can trigger Google Drive re-sync and share public view-only links.'
                : 'Welcome to the official public archive! You can view and browse all yearbooks in landscape spread mode with realistic page-flipping animations with zero app installation required.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handleShareArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-[11px] shadow-2xs transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Public Link</span>
            </button>

            {!isAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="text-amber-900 hover:text-amber-950 font-medium underline underline-offset-2 text-[11px] flex items-center gap-1"
              >
                <Lock className="w-3 h-3 text-amber-800" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero Archival Banner */}
        <section className="mb-8 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#142338] via-[#0d1726] to-[#08101a] text-amber-50 shadow-xl border border-amber-600/30 relative overflow-hidden">
          {/* Subtle watermarked seal background */}
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none select-none w-72 h-72 flex items-center justify-center">
            <img 
              src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png" 
              alt="" 
              className="w-full h-full object-contain filter brightness-200" 
            />
          </div>

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-serif font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gloria Dei Vivens Homo • PIK Campus Archive</span>
            </div>

            <div className="flex items-center gap-3.5 mb-2">
              <div className="p-1 rounded-xl bg-white/90 shadow-lg border border-amber-400/40 shrink-0">
                <img
                  src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png"
                  alt="Bina Bangsa School Logo"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h2 className="font-serif font-black text-2xl sm:text-3xl lg:text-4xl text-amber-100 tracking-tight leading-tight">
                Bina Bangsa School-Pantai Indah Kapuk
              </h2>
            </div>

            <p className="mt-2 text-xs sm:text-sm text-amber-200/80 font-serif leading-relaxed">
              Official digitized yearbook repository for Bina Bangsa School Pantai Indah Kapuk. Explore authentic graduating class chronicles, athletic championships, faculty forewords, and student memories preserved in high-fidelity landscape flipbook spreads with animated page flipping.
            </p>

            {/* Quick stats */}
            <div className="mt-5 pt-4 border-t border-amber-900/50 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-amber-300/80">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span><strong>{yearbooks.length}</strong> Volumes Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Format: <strong>Landscape Spread &amp; Grid Only</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Animation: <strong>3D Flip Animation</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Access: <strong>Zero App Installation Required</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/60 p-4 border border-amber-900/10 shadow-xs animate-pulse flex flex-col gap-3"
              >
                <div className="aspect-[1.414/1] bg-amber-900/10 rounded-xl" />
                <div className="h-4 bg-amber-900/10 rounded w-3/4" />
                <div className="h-3 bg-amber-900/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchData(true)}
              className="px-3 py-1 bg-amber-800 text-white rounded-lg hover:bg-amber-900 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Bookshelf View Mode */}
        {!isLoading && viewMode === 'shelf' && (
          <BookshelfView
            yearbooks={filteredYearbooks}
            onSelect={(yb) => setSelectedYearbook(yb)}
          />
        )}

        {/* Grid View Mode */}
        {!isLoading && viewMode === 'grid' && (
          <>
            {filteredYearbooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-7">
                {filteredYearbooks.map((yearbook) => (
                  <YearbookCard
                    key={yearbook.id}
                    yearbook={yearbook}
                    onSelect={(yb) => setSelectedYearbook(yb)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center rounded-2xl bg-white/50 border border-amber-900/10 p-8 max-w-md mx-auto">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif font-bold text-base text-slate-800">
                  No Yearbooks Found
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                  No editions matched your search or era criteria. Try clearing your filters or searching for another term.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDecade('all');
                  }}
                  className="px-4 py-2 bg-amber-900 text-amber-100 rounded-xl text-xs font-semibold hover:bg-amber-950 transition"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-[#eee9df] border-t border-amber-900/15 py-6 px-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img 
              src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png" 
              alt="Bina Bangsa School Logo" 
              className="h-7 w-auto object-contain bg-white/70 p-0.5 rounded" 
            />
            <span className="font-serif font-bold text-slate-800">
              Bina Bangsa School-Pantai Indah Kapuk Yearbook Archive
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Public View-Only Edition • Realistic Landscape Spread Flip Animation • No App Installation Required
          </p>

          <div className="flex items-center gap-3 text-[11px] text-amber-900 font-medium">
            <button
              onClick={handleShareArchive}
              className="hover:underline flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              <span>Share Link</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="hover:underline flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3 text-amber-800" />
              <span>{isAdmin ? 'Admin Portal' : 'Admin Access'}</span>
            </button>
            <span>•</span>
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:underline"
            >
              Back to Top
            </button>
          </div>
        </div>
      </footer>

      {/* Admin Portal Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        isAdmin={isAdmin}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onForceRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        driveStatus={driveStatus}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        itemCount={yearbooks.length}
      />

      {/* Google Drive Status & Telemetry Modal */}
      <DriveStatusModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        status={driveStatus}
        secondsUntilNextPoll={secondsUntilNextPoll}
        onForceRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        itemCount={yearbooks.length}
      />
    </div>
  );
}
