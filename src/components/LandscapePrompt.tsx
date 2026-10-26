import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw, X, Maximize } from 'lucide-react';

interface LandscapePromptProps {
  onDismiss?: () => void;
  onRequestFullscreen?: () => void;
}

export const LandscapePrompt: React.FC<LandscapePromptProps> = ({
  onRequestFullscreen,
}) => {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      const isPortrait = window.innerHeight > window.innerWidth;
      const isSmallScreen = window.innerWidth < 850;
      setIsPortraitMobile(isPortrait && isSmallScreen);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortraitMobile || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-16 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-950/95 text-amber-100 border border-amber-500/50 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2.5">
        <div className="relative p-2 rounded-xl bg-amber-900/80 text-amber-300 shrink-0">
          <Smartphone className="w-5 h-5 animate-pulse" />
          <RotateCw className="w-3.5 h-3.5 absolute -top-1 -right-1 text-amber-400" />
        </div>
        <div className="text-xs">
          <span className="font-serif font-bold text-amber-200 block">Rotate to Landscape</span>
          <span className="text-amber-200/80 text-[11px] leading-tight block">
            Turn your device sideways for the full double-page yearbook spread.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onRequestFullscreen && (
          <button
            onClick={onRequestFullscreen}
            className="p-1.5 rounded-lg bg-amber-800/80 hover:bg-amber-800 text-amber-100 text-[11px] font-medium transition"
            title="Full Screen"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-amber-400/70 hover:text-amber-200 hover:bg-amber-900/50 transition"
          title="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
