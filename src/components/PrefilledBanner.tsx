import React from "react";

interface PrefilledBannerProps {
  source: string;       // e.g. "your D&O form" or "your Trade Credit form"
  onConfirm: () => void;
}

export function PrefilledBanner({ source, onConfirm }: PrefilledBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 -mt-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
      <span className="text-[12px] text-amber-700">
        Pre-filled from {source} — please confirm this is correct
      </span>
      <button
        type="button"
        onClick={onConfirm}
        className="shrink-0 text-[12px] font-medium text-amber-800 border border-amber-300 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
      >
        Confirm ✓
      </button>
    </div>
  );
}
