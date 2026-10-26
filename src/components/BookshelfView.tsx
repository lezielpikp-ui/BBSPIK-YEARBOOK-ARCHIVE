import React from 'react';
import { Yearbook } from '../types/yearbook';
import { BookOpen } from 'lucide-react';

interface BookshelfViewProps {
  yearbooks: Yearbook[];
  onSelect: (yearbook: Yearbook) => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({ yearbooks, onSelect }) => {
  // Spine colors palette for realistic vintage leather, buckram cloth, and modern binding
  const spinePalettes = [
    { bg: 'bg-[#831843]', text: 'text-amber-200', border: 'border-amber-600/40', rib: 'bg-amber-400/40' },
    { bg: 'bg-[#0f172a]', text: 'text-sky-200', border: 'border-sky-500/40', rib: 'bg-sky-400/40' },
    { bg: 'bg-[#1e1b4b]', text: 'text-purple-200', border: 'border-purple-500/40', rib: 'bg-purple-400/40' },
    { bg: 'bg-[#064e3b]', text: 'text-amber-200', border: 'border-amber-500/40', rib: 'bg-amber-400/40' },
    { bg: 'bg-[#451a03]', text: 'text-amber-300', border: 'border-amber-600/40', rib: 'bg-amber-400/40' },
    { bg: 'bg-[#701a75]', text: 'text-fuchsia-200', border: 'border-fuchsia-500/40', rib: 'bg-fuchsia-400/40' },
  ];

  return (
    <div className="w-full my-6">
      {/* Wooden Shelf Container */}
      <div className="relative pt-8 pb-4 px-4 sm:px-8 bg-gradient-to-b from-[#2a1b14] to-[#1c120c] rounded-2xl shadow-2xl border-4 border-[#3d271d] overflow-hidden">
        {/* Wall background texture behind books */}
        <div className="absolute inset-0 bg-[#160d09] opacity-80 pointer-events-none" />

        {/* Shelf Header */}
        <div className="relative z-10 flex items-center justify-between pb-6 mb-2 border-b border-amber-900/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span className="font-serif font-bold text-xs uppercase tracking-widest text-amber-300">
              The Curated Stacks • Select a Volume to Read
            </span>
          </div>
          <span className="text-[11px] text-amber-400/70 font-serif">
            {yearbooks.length} Editions Archived
          </span>
        </div>

        {/* The Books on the Shelf */}
        <div className="relative z-10 flex items-end justify-start gap-3 sm:gap-5 overflow-x-auto pb-2 pt-8 min-h-[340px] scrollbar-thin scrollbar-thumb-amber-900/60">
          {yearbooks.map((yearbook, idx) => {
            const palette = spinePalettes[idx % spinePalettes.length];
            // Height variance for authentic aged books
            const heightClass =
              idx % 3 === 0 ? 'h-[280px]' : idx % 3 === 1 ? 'h-[295px]' : 'h-[270px]';

            return (
              <div
                key={yearbook.id}
                onClick={() => onSelect(yearbook)}
                className={`group relative flex-shrink-0 cursor-pointer flex flex-col justify-between w-14 sm:w-16 ${heightClass} ${palette.bg} rounded-t-sm shadow-xl border-x ${palette.border} transition-all duration-300 hover:-translate-y-4 hover:shadow-2xl hover:z-20`}
              >
                {/* 3D Spine highlights & Book Ribs */}
                <div className="absolute inset-y-0 left-0 w-2 bg-white/10 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-2 bg-black/40 pointer-events-none" />

                {/* Top Rib */}
                <div className="pt-3 px-1">
                  <div className={`h-1 w-full ${palette.rib} rounded-xs shadow-xs mb-1`} />
                  <div className={`h-1 w-full ${palette.rib} rounded-xs shadow-xs`} />
                </div>

                {/* Vertical Book Spine Title */}
                <div className="my-auto flex-1 flex items-center justify-center py-4 overflow-hidden">
                  <span
                    className={`font-serif font-bold text-xs sm:text-sm tracking-wider uppercase ${palette.text} transform -rotate-90 whitespace-nowrap select-none drop-shadow-sm`}
                  >
                    {yearbook.title.length > 24 ? yearbook.title.slice(0, 22) + '...' : yearbook.title}
                  </span>
                </div>

                {/* Bottom Year Emblem & Rib */}
                <div className="pb-3 px-1 text-center">
                  {(yearbook.yearLabel || yearbook.year) && (
                    <div className="mb-2">
                      <span className={`font-serif font-black text-[11px] ${palette.text} drop-shadow-sm`}>
                        {yearbook.yearLabel || yearbook.year}
                      </span>
                    </div>
                  )}
                  <div className={`h-1 w-full ${palette.rib} rounded-xs shadow-xs mb-1`} />
                  <div className={`h-1 w-full ${palette.rib} rounded-xs shadow-xs`} />
                </div>

                {/* Tooltip on Hover */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap bg-amber-950 text-amber-200 text-[10px] font-serif py-1 px-2.5 rounded-md border border-amber-500/40 shadow-xl">
                  {yearbook.title} ({yearbook.yearLabel || yearbook.year || 'Ed.'})
                </div>
              </div>
            );
          })}
        </div>

        {/* Solid Wooden Shelf Plank */}
        <div className="relative z-10 w-full h-6 bg-gradient-to-r from-[#5a3825] via-[#754a32] to-[#5a3825] border-t-2 border-[#8c593c] shadow-lg rounded-b-sm flex items-center px-4">
          <div className="w-full h-1 bg-black/20" />
        </div>
      </div>
    </div>
  );
};
