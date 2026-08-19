/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface RestoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  backupTimestamp?: string;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  backupTimestamp
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
        className="bg-[#0a0f1d] border border-amber-500/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-amber-400">
          <span className="text-2xl">🔄</span>
          <h3 className="text-sm font-extrabold uppercase tracking-wider">Disaster Recovery Restore</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Database corruption or a cleared cache was detected. Would you like to restore your channels and PlaceCard matrix from the 24-hour backup vault?
        </p>

        {backupTimestamp && (
          <div className="text-[10px] text-slate-500 font-sans">
            Snapshot taken: {new Date(parseInt(backupTimestamp, 10)).toLocaleString()}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
          >
            Skip
          </button>
          <button
            onClick={() => {
              onRestore();
              onClose();
            }}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded text-xs shadow transition"
          >
            📥 Restore Snapshot
          </button>
        </div>
      </div>
    </div>
  );
};
