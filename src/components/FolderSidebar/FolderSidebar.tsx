/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useFolderRegistry } from "./useFolderRegistry";
import styles from "./FolderSidebar.module.css";

interface FolderSidebarProps {
  selectedFolderId: string;
  onSelectFolder: (id: string) => void;
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  selectedFolderId,
  onSelectFolder
}) => {
  const { folders, loading, addFolder, removeFolder } = useFolderRegistry();
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const ok = await addFolder(newFolderName.trim(), "Custom created folder collection");
    if (ok) {
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  return (
    <aside className={styles.sidebarContainer}>
      {/* SIDEBAR HEADER */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <span className="font-mono text-xs font-black tracking-widest text-emerald-400 uppercase">
          VAULT REGISTRY
        </span>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-sm flex items-center justify-center border border-slate-700 transition"
          title="New Folder"
        >
          {isCreating ? "✕" : "+"}
        </button>
      </div>

      {/* NEW FOLDER QUICK FORM */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-3 bg-slate-900/90 border-b border-slate-800 flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder Name..."
            autoFocus
            className="flex-1 bg-black border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-bold text-xs rounded uppercase"
          >
            ADD
          </button>
        </form>
      )}

      {/* SPECIAL "ALL CONTENT" TAB */}
      <div className="py-2 border-b border-slate-800/50">
        <div
          onClick={() => onSelectFolder("all")}
          className={`${styles.folderItem} ${selectedFolderId === "all" ? styles.activeFolder : ""}`}
        >
          <div className="flex items-center gap-2.5">
            <span>🗃️</span>
            <span className="font-bold">ALL BROADCASTS</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">MATRIX</span>
        </div>
      </div>

      {/* REGISTERED FOLDERS LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {loading ? (
          <div className="p-4 text-center text-xs font-mono text-slate-600 animate-pulse">
            Loading Folders...
          </div>
        ) : (
          folders.map((folder) => {
            const isActive = selectedFolderId === folder.id;
            return (
              <div
                key={`sidebar_folder_${folder.id}`}
                onClick={() => onSelectFolder(folder.id)}
                className={`${styles.folderItem} ${isActive ? styles.activeFolder : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0">{folder.icon || "📁"}</span>
                  <span className="truncate">{folder.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {folder.isSystemLocked ? (
                    <span className={styles.systemBadge}>LOCK</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete folder "${folder.name}"?`)) {
                          removeFolder(folder.id);
                        }
                      }}
                      className="text-slate-600 hover:text-red-400 font-bold px-1 transition text-xs"
                      title="Delete Folder"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SIDEBAR FOOTER TELEMETRY */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80 font-mono text-[10px] text-slate-500 flex justify-between">
        <span>STORAGE: IDB VAULT</span>
        <span className="text-emerald-500 font-bold">ATOMIC READY</span>
      </div>
    </aside>
  );
};
