import React from 'react';
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
  Sparkles
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
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
  driveStatus: DriveStatus | null;
  onOpenDriveModal: () => void;
  secondsUntilNextPoll: number;
  onForceRefresh: () => void;
  isRefreshing: boolean;
  decades: string[];
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
  driveStatus,
  onOpenDriveModal,
  secondsUntilNextPoll,
  onForceRefresh,
  isRefreshing,
  decades,
}) => {
  const isLiveDrive = driveStatus?.configured && !driveStatus?.error;

  return (
    <header className="sticky top-0 z-40 bg-[#fdfbf7]/95 backdrop-blur-md border-b border-amber-900/15 shadow-xs transition-all">
      {/* Top Banner with Crest, Brand & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Emblem */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0 flex items-center justify-center p-1 rounded-xl bg-white/70 border border-teal-900/10 shadow-xs">
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
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300/60 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-amber-700" /> Archive
              </span>
            </div>
            <p className="text-xs text-slate-500 font-serif italic">
              Official Digital Yearbook Archive • Pantai Indah Kapuk Campus
            </p>
          </div>
        </div>

        {/* Status badges, Sound, PWA, Drive Sync */}
        <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto">
          {/* Drive status button */}
          <button
            onClick={onOpenDriveModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${
              isLiveDrive
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300/80 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100'
            }`}
            title="Click to view Google Drive connection details & polling timer"
          >
            <FolderSync className={`w-3.5 h-3.5 ${isLiveDrive ? 'text-emerald-700' : 'text-amber-700'}`} />
            <span>{isLiveDrive ? 'Drive Sync' : 'Demo Mode'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            <span className="text-[10px] opacity-75">{secondsUntilNextPoll}s</span>
          </button>

          {/* Manual refresh button */}
          <button
            onClick={onForceRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border border-amber-900/15 bg-white text-slate-700 hover:bg-amber-50 hover:text-slate-900 transition disabled:opacity-40"
            title="Force refresh from Google Drive"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-700' : ''}`} />
          </button>

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

          {/* PWA Install Button */}
          <PWAInstallButton />
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
            {/* Decade Filter */}
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

            {/* View Mode Toggle: Grid vs Bookshelf */}
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
