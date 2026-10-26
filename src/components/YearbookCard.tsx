import React, { useState, useEffect } from 'react';
import { Yearbook } from '../types/yearbook';
import { BookOpen, Calendar, HardDrive, FileText, CloudCheck, Sparkles } from 'lucide-react';
import { loadPdfDocument } from '../utils/pdfLoader';

interface YearbookCardProps {
  yearbook: Yearbook;
  onSelect: (yearbook: Yearbook) => void;
}

export const YearbookCard: React.FC<YearbookCardProps> = ({ yearbook, onSelect }) => {
  const [dynamicCover, setDynamicCover] = useState<string | null>(yearbook.coverImage);

  useEffect(() => {
    if (yearbook.coverImage) {
      setDynamicCover(yearbook.coverImage);
      return;
    }

    if (!yearbook.isSample && yearbook.mimeType === 'application/pdf' && yearbook.pdfStreamUrl) {
      let active = true;
      loadPdfDocument(yearbook.pdfStreamUrl)
        .then((pdf) => pdf.getPageThumbnail(1))
        .then((thumb) => {
          if (active && thumb) setDynamicCover(thumb);
        })
        .catch(() => {
          // ignore fallback
        });

      return () => {
        active = false;
      };
    }
  }, [yearbook.coverImage, yearbook.pdfStreamUrl, yearbook.isSample, yearbook.mimeType]);

  const formattedDate = new Date(yearbook.modifiedTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => onSelect(yearbook)}
      className="group relative cursor-pointer flex flex-col bg-[#fdfbf7] rounded-2xl border border-amber-900/15 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      {/* Book Cover Container in Landscape Orientation matching authentic A4 yearbook covers */}
      <div className="relative aspect-[1.414/1] w-full bg-slate-950 overflow-hidden flex items-center justify-center p-3 sm:p-4">
        {/* Realistic Book Spine shadow overlay on left side */}
        <div className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/60 via-black/25 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 left-4 w-[1px] bg-amber-400/40 z-10 pointer-events-none" />

        {/* Cover Graphic / Thumbnail */}
        {dynamicCover ? (
          <img
            src={dynamicCover}
            alt={yearbook.title}
            className="w-full h-full object-contain rounded-xs shadow-md transition-transform duration-500 group-hover:scale-102"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full rounded-xs bg-gradient-to-br from-[#0e233d] via-slate-900 to-[#14365d] p-5 flex flex-col justify-between border border-amber-500/30 text-center relative">
            <div className="flex items-center justify-between border-b border-amber-400/30 pb-1.5">
              <div className="flex items-center gap-1.5">
                <img
                  src="/assets/aistudio/Logo_Bina_Bangsa_School_Vertikal_RGB-03_4d2a2b49.png"
                  alt=""
                  className="h-4 w-auto object-contain bg-white/90 p-0.5 rounded-xs"
                />
                <span className="text-[9px] tracking-widest uppercase font-serif text-amber-200">
                  Bina Bangsa School
                </span>
              </div>
              <span className="text-[9px] font-mono text-amber-300/80">PIK Campus</span>
            </div>
            <div className="my-auto py-2">
              <div className="text-3xl font-serif font-black text-amber-300">
                {yearbook.yearLabel || yearbook.year || '•••'}
              </div>
              <div className="text-xs sm:text-sm font-serif font-bold text-amber-100 mt-1 line-clamp-2">
                {yearbook.title}
              </div>
            </div>
            <div className="text-[10px] font-serif text-amber-200/70 italic border-t border-amber-400/20 pt-1">
              Click to Open Flipbook in Landscape
            </div>
          </div>
        )}

        {/* Badge: Publication Year */}
        {(yearbook.yearLabel || yearbook.year) && (
          <div className="absolute top-3 right-3 z-20">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-serif font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40 shadow-md backdrop-blur-xs">
              {yearbook.yearLabel || yearbook.year}
            </span>
          </div>
        )}

        {/* Badge: Source (Drive vs Showcase) */}
        <div className="absolute bottom-3 left-7 z-20">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-md shadow-xs ${
              yearbook.isSample
                ? 'bg-amber-900/80 text-amber-200 border border-amber-500/30'
                : 'bg-emerald-950/85 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {yearbook.isSample ? (
              <>
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                <span>Showcase Edition</span>
              </>
            ) : (
              <>
                <CloudCheck className="w-2.5 h-2.5 text-emerald-400" />
                <span>Drive Synced</span>
              </>
            )}
          </span>
        </div>

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-amber-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
          <span className="inline-flex items-center gap-2 bg-[#fdfbf7] text-slate-900 px-4 py-2 rounded-xl font-serif font-bold text-xs shadow-xl border border-amber-300 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <BookOpen className="w-4 h-4 text-amber-800" />
            Open Flipbook
          </span>
        </div>
      </div>

      {/* Book Metadata & Footer */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-serif font-bold text-base text-slate-900 group-hover:text-amber-900 transition-colors line-clamp-1">
            {yearbook.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {yearbook.description || `Digitized yearbook edition preserved in the public digital archive.`}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-amber-900/10 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="File size">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              {yearbook.sizeFormatted}
            </span>
            {yearbook.pageCount && (
              <span className="flex items-center gap-1" title="Pages">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {yearbook.pageCount} pages
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[10px] text-slate-400" title="Last updated in Drive">
            <Calendar className="w-3 h-3" />
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
};
