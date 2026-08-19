/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface PerformanceWarningToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const PerformanceWarningToast: React.FC<PerformanceWarningToastProps> = ({
  message,
  onDismiss
}) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#110808] border border-red-500 rounded-xl p-4 shadow-2xl flex items-start gap-3 animate-slide-up font-mono">
      <span className="text-xl text-red-400 shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">SLA Performance Warning</h4>
        <p className="text-[11px] text-slate-300 mt-1 break-words">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-500 hover:text-white font-bold text-xs p-1"
      >
        ✕
      </button>
    </div>
  );
};
