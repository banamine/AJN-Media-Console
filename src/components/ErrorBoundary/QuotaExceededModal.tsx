/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEvictCache: () => void;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  onEvictCache
}) => {
  useEscapeKey(() => {
    if (isOpen) onClose();
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0f1d] border border-red-500/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-red-400">
          <span className="text-2xl">💾</span>
          <h3 className="text-sm font-extrabold uppercase tracking-wider">Storage Quota Exceeded</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          The browser IndexedDB vault reached its storage ceiling (DOMException: QuotaExceededError).
        </p>

        <div className="bg-black/60 border border-slate-800 rounded p-3 text-[11px] text-amber-400">
          Protocol v2.0 Resilience intervention can evict transient cache tables (`import_cache`) to reclaim space safely.
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onEvictCache();
              onClose();
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-red-500 text-white font-bold rounded text-xs shadow transition"
          >
            ⚡ Evict Transient Cache
          </button>
        </div>
      </div>
    </div>
  );
};
