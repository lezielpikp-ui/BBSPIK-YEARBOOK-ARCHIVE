import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  X, 
  Volume2, 
  VolumeX, 
  FolderSync, 
  Library, 
  LayoutGrid, 
  RefreshCw,
  Sparkles,
  Share2,
  ShieldCheck,
  Lock,
  Check,
  Eye
} from 'lucide-react';
import { DriveStatus } from '../types/yearbook';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDecade: string;
  onDecadeChange: (decade: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewMode: 'grid' | 'shelf';
  onViewModeChange: (mode: 'grid' | 'shelf') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isAdmin: boolean;
  onOpenAdminModal: () => void;
  onShareArchive: () => void;
  decades: string[];
  driveStatus?: DriveStatus | null;
  onOpenDriveModal?: () => void;
  onForceRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  selectedDecade,
  onDecadeChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  soundEnabled,
  onToggleSound,
  isAdmin,
  onOpenAdminModal,
  onShareArchive,
  decades,
  driveStatus,
  onOpenDriveModal,
  onForceRefresh,
  isRefreshing = false,
}) => {
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const handleShareClick = () => {
    onShareArchive();
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const isLiveDrive = driveStatus?.configured && !driveStatus?.error;

  return (
    <header className="sticky top-0 z-40 bg-[#fdfbf7]/95 backdrop-blur-md border-b border-amber-900/15 shadow-xs transition-all">
      {/* Top Banner with Brand, Admin/Share actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Crest */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0 flex items-center justify-center p-1 rounded-xl bg-white/80 border border-teal-900/10 shadow-xs">
            <img
              src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png"
              alt="Bina Bangsa School Logo"
              className="h-12 w-auto object-contain drop-shadow-xs hover:scale-105 transition-transform"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-black text-lg sm:text-xl lg:text-2xl text-slate-900 tracking-tight leading-snug">
                Bina Bangsa School-Pantai Indah Kapuk
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300/60 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-amber-700" /> Archive
              </span>
            </div>
            <p className="text-xs text-slate-500 font-serif italic flex items-center gap-2">
              <span>Official Digital Yearbook Archive • Pantai Indah Kapuk Campus</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-amber-800 font-medium not-italic text-[11px] flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-700" /> Public View Only
              </span>
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          {/* Share Archive Button (View-Only public link) */}
          <button
            onClick={handleShareClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${
              copiedShare
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white border-amber-900/20 text-slate-700 hover:bg-amber-50 hover:text-slate-900'
            }`}
            title="Copy public view-only link to share with students and parents"
          >
            {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5 text-amber-800" />}
            <span>{copiedShare ? 'Link Copied!' : 'Share Archive'}</span>
          </button>

          {/* If ADMIN is logged in: show update and drive controls */}
          {isAdmin ? (
            <>
              {onForceRefresh && (
                <button
                  onClick={onForceRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-800 hover:bg-amber-900 text-white shadow-2xs transition disabled:opacity-40"
                  title="Force re-sync and update archive from Google Drive"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Update Archive'}</span>
                </button>
              )}

              {onOpenDriveModal && (
                <button
                  onClick={onOpenDriveModal}
                  className="p-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition"
                  title="Google Drive telemetry"
                >
                  <FolderSync className="w-4 h-4 text-emerald-700" />
                </button>
              )}

              <button
                onClick={onOpenAdminModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-100/90 text-emerald-950 border border-emerald-300 transition shadow-2xs"
                title="Admin session active"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>
            </>
          ) : (
            /* If PUBLIC viewer: show subtle admin access unlock */
            <button
              onClick={onOpenAdminModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-900/15 bg-white/80 text-slate-600 hover:bg-amber-50 hover:text-slate-900 transition"
              title="Admin Portal (For archive managers to update Google Drive records)"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* Sound toggle */}
          <button
            onClick={onToggleSound}
            className={`flex items-center gap-1 p-1.5 px-2.5 rounded-lg text-xs font-medium border transition ${
              soundEnabled
                ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                : 'bg-white border-amber-900/15 text-slate-400 hover:text-slate-700'
            }`}
            title={soundEnabled ? 'Paper flip sound enabled' : 'Sound muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-800" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Audio' : 'Mute'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#f7f3ec] border-t border-amber-900/10 px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by yearbook title, year, or keyword..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-white rounded-lg border border-amber-900/20 text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters, Sort, and View Mode Toggle */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Era Filter */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-amber-900/15">
              <span className="text-slate-500 font-medium">Era:</span>
              <select
                value={selectedDecade}
                onChange={(e) => onDecadeChange(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Editions</option>
                {decades.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-amber-900/15">
              <span className="text-slate-500 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="year-desc">Year (Newest First)</option>
                <option value="year-asc">Year (Oldest First)</option>
                <option value="title-asc">Title (A to Z)</option>
                <option value="updated-desc">Recently Updated</option>
              </select>
            </div>

            {/* View Mode Toggle: Grid vs Shelf */}
            <div className="flex items-center bg-white rounded-lg border border-amber-900/15 p-0.5 ml-auto md:ml-0">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'grid'
                    ? 'bg-amber-900 text-amber-50 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid layout view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange('shelf')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'shelf'
                    ? 'bg-amber-900 text-amber-50 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Bookshelf spine view"
              >
                <Library className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
