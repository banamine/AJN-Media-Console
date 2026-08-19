import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { safeLocalStorage } from "../utils/safeStorage";
import { 
  Save, 
  RotateCcw, 
  Plus, 
  Search, 
  Download, 
  X, 
  FileText, 
  Check, 
  Trash2, 
  History, 
  PlusCircle, 
  ChevronRight, 
  Code, 
  FileCode,
  Edit2,
  List,
  RefreshCw,
  FolderOpen,
  Undo2,
  Redo2,
  AlertTriangle,
  Info,
  CheckCircle,
  FileDown,
  Star,
  LayoutGrid,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IPTVChannel, M3UPlaylist, M3UPlaylistVersion } from "../types";
import { PlaylistVault, parseM3UPlaylistAsync } from "../services/PlaylistVault";

interface PlaylistEditorProps {
  theme: "dark" | "light";
  playlists: M3UPlaylist[];
  channels: IPTVChannel[];
  reloadVault: () => Promise<void>;
  addLog: (msg: string, type?: "info" | "warning" | "error") => void;
}

interface M3UValidationError {
  line: number;
  message: string;
  type: "warning" | "error";
}

export function PlaylistEditor({
  theme,
  playlists: initialPlaylists,
  channels: initialChannels,
  reloadVault,
  addLog
}: PlaylistEditorProps) {
  // Local state
  const [playlists, setPlaylists] = useState<M3UPlaylist[]>(initialPlaylists);
  const [selectedPlaylist, setSelectedPlaylist] = useState<M3UPlaylist | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [playlistName, setPlaylistName] = useState<string>("");
  const [isNewPlaylist, setIsNewPlaylist] = useState<boolean>(false);
  
  // Search & Replace state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replaceQuery, setReplaceQuery] = useState<string>("");
  const [searchMatchesCount, setSearchMatchesCount] = useState<number>(0);
  
  // Single Channel Append Form (supports tvg-id, group-title, tvg-logo, tvg-chno)
  const [showChannelForm, setShowChannelForm] = useState<boolean>(false);
  const [newChanName, setNewChanName] = useState<string>("");
  const [newChanUrl, setNewChanUrl] = useState<string>("");
  const [newChanGroup, setNewChanGroup] = useState<string>("Custom Group");
  const [newChanLogo, setNewChanLogo] = useState<string>("");
  const [newChanChno, setNewChanChno] = useState<string>("");
  const [newChanTvgId, setNewChanTvgId] = useState<string>("");

  // Vault UI states
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultSort, setVaultSort] = useState<"date" | "alpha" | "size">("date");
  const [layoutMode, setLayoutMode] = useState<"list" | "grid">("list");
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const stored = safeLocalStorage.getItem("ajn_vault_pinned");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    archives: false,
    defaults: true,
    custom: true
  });

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const newPinned = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      safeLocalStorage.setItem("ajn_vault_pinned", JSON.stringify(newPinned));
      return newPinned;
    });
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const processedPlaylists = useMemo(() => {
    let result = [...playlists];
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase();
      result = result.filter(pl => pl.name.toLowerCase().includes(q) || (pl.url && pl.url.toLowerCase().includes(q)));
    }
    result.sort((a, b) => {
      if (vaultSort === "alpha") {
        return a.name.localeCompare(b.name);
      } else if (vaultSort === "size") {
        return (b.channelCount || 0) - (a.channelCount || 0);
      } else {
        return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime();
      }
    });
    const pinned = result.filter(pl => pinnedIds.includes(pl.id));
    const unpinned = result.filter(pl => !pinnedIds.includes(pl.id));
    const archives = unpinned.filter(pl => pl.name.startsWith("Archive -") || pl.name.toLowerCase().includes("archive"));
    const defaults = unpinned.filter(pl => pl.name === "Default Feed" || pl.name === "AJN Broadcasts");
    const custom = unpinned.filter(pl => !archives.includes(pl) && !defaults.includes(pl));
    return { pinned, archives, defaults, custom };
  }, [playlists, vaultSearch, vaultSort, pinnedIds]);

  // Undo/Redo Memory Stacks
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const isInternalChangeRef = useRef<boolean>(false);

  // Editor Line Numbers
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync playlists from props when changed
  useEffect(() => {
    setPlaylists(initialPlaylists);
    // If we have a selected playlist, keep it up to date
    if (selectedPlaylist) {
      const updated = initialPlaylists.find(p => p.id === selectedPlaylist.id);
      if (updated) {
        setSelectedPlaylist(updated);
      }
    }
  }, [initialPlaylists]);

  // Load playlist into editor
  const handleSelectPlaylist = useCallback((playlist: M3UPlaylist) => {
    setSelectedPlaylist(playlist);
    setPlaylistName(playlist.name);
    setIsNewPlaylist(false);
    setShowChannelForm(false);
    
    // Clear undo/redo stacks when loading a new file
    isInternalChangeRef.current = true;
    setEditorContent(playlist.content || "");
    setUndoStack([]);
    setRedoStack([]);
    
    addLog(`Opened playlist "${playlist.name}" in code editor.`, "info");
  }, [addLog]);

  // Create template for a new playlist
  const handleInitNewPlaylist = useCallback(() => {
    const template = `#EXTM3U x-tvg-name="My Brand New Playlist"

#EXTINF:-1 tvg-id="custom-chan-1" group-title="My Custom Channels" tvg-logo="" tvg-chno="01",My Custom Stream 1
https://rumble.com/embed/v79lfxq/?pub=15son
`;
    setSelectedPlaylist(null);
    setPlaylistName("New Custom Playlist");
    setIsNewPlaylist(true);
    setShowChannelForm(false);
    
    // Reset undo/redo stacks
    isInternalChangeRef.current = true;
    setEditorContent(template);
    setUndoStack([]);
    setRedoStack([]);
    
    addLog("Created a new M3U playlist template in code editor.", "info");
  }, [addLog]);

  // Code editor sync scrolling of line numbers
  const handleScroll = () => {
    requestAnimationFrame(() => {
      if (textareaRef.current && lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    });
  };

  // Generate line numbers array
  const linesCount = useMemo(() => {
    return editorContent.split("\n").length || 1;
  }, [editorContent]);

  const lineNumbersArray = useMemo(() => {
    return Array.from({ length: linesCount }, (_, i) => i + 1);
  }, [linesCount]);

  // Handle custom editor change with Undo/Redo registration
  const handleEditorChange = (val: string) => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    // Record past state in undo stack, up to 30 history items
    setUndoStack(prev => [...prev.slice(-29), editorContent]);
    setRedoStack([]); // Clear redo
    setEditorContent(val);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevText = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, editorContent]);
    isInternalChangeRef.current = true;
    setEditorContent(prevText);
    addLog("Undone last editor change.", "info");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextText = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, editorContent]);
    isInternalChangeRef.current = true;
    setEditorContent(nextText);
    addLog("Redone editor change.", "info");
  };

  // Parse check in real-time
  const [parsedChannelsCount, setParsedChannelsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    parseM3UPlaylistAsync(editorContent, selectedPlaylist?.url).then(parsed => {
      if (isMounted) {
        setParsedChannelsCount(parsed.length);
      }
    }).catch(() => {
      if (isMounted) {
        setParsedChannelsCount(0);
      }
    });
    return () => { isMounted = false; };
  }, [editorContent]);

  // Syntax Validation Algorithm
  const validationErrors = useMemo<M3UValidationError[]>(() => {
    const errors: M3UValidationError[] = [];
    const lines = editorContent.split("\n");
    const seenTvgIds = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      if (line.startsWith("#EXTINF:")) {
        // 1. Check for missing comma before display name
        let insideQuotes = false;
        let foundComma = false;
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            foundComma = true;
            break;
          }
        }

        if (!foundComma) {
          errors.push({
            line: lineNum,
            message: "Missing comma separator before channel display name (e.g. #EXTINF:-1,My Channel Name).",
            type: "error"
          });
        }

        // 2. Check for tvg-id duplicates
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
        if (tvgIdMatch) {
          const tvgId = tvgIdMatch[1];
          if (seenTvgIds.has(tvgId)) {
            errors.push({
              line: lineNum,
              message: `Duplicate tvg-id attribute value found: "${tvgId}". This will cause collisions in TV guides.`,
              type: "warning"
            });
          } else {
            seenTvgIds.add(tvgId);
          }
        }
      } else if (line.length > 0 && !line.startsWith("#")) {
        // 3. Check for non-HTTP/HTTPS stream URLs (RTSP, RTMP, etc.)
        if (!line.startsWith("http://") && !line.startsWith("https://")) {
          errors.push({
            line: lineNum,
            message: `Stream URL protocol is not HTTP or HTTPS. Downstream browser players may fail to play this stream directly.`,
            type: "warning"
          });
        }
      }
    }

    return errors;
  }, [editorContent]);

  // Handle word search counting
  useEffect(() => {
    if (!searchQuery) {
      setSearchMatchesCount(0);
      return;
    }
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = editorContent.match(regex);
    setSearchMatchesCount(matches ? matches.length : 0);
  }, [searchQuery, editorContent]);

  // Execute word replace
  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const updated = editorContent.replace(regex, replaceQuery);
    
    // Save to Undo stack
    setUndoStack(prev => [...prev.slice(-29), editorContent]);
    setRedoStack([]);
    
    setEditorContent(updated);
    addLog(`Replaced matches of "${searchQuery}" with "${replaceQuery}".`, "info");
  };

  // Append a single new channel to raw text editor
  const handleAppendChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName || !newChanUrl) {
      alert("Name and Stream URL are required!");
      return;
    }

    // Dynamic Attribute Support
    let extinfLine = `#EXTINF:-1 group-title="${newChanGroup || "Uncategorized"}"`;
    if (newChanTvgId) extinfLine += ` tvg-id="${newChanTvgId}"`;
    if (newChanLogo) extinfLine += ` tvg-logo="${newChanLogo}"`;
    if (newChanChno) extinfLine += ` tvg-chno="${newChanChno}"`;
    extinfLine += `,${newChanName}\n${newChanUrl}\n`;

    // Record past state to Undo stack
    setUndoStack(prev => [...prev.slice(-29), editorContent]);
    setRedoStack([]);

    setEditorContent(prev => prev + (prev.endsWith("\n") ? "" : "\n") + extinfLine);
    setShowChannelForm(false);
    
    // Reset form fields
    setNewChanName("");
    setNewChanUrl("");
    setNewChanGroup("Custom Group");
    setNewChanLogo("");
    setNewChanChno("");
    setNewChanTvgId("");
    
    addLog(`Appended custom channel "${newChanName}" to code editor.`, "info");
  };

  // Standard Export as M3U file
  const handleDownloadM3U = () => {
    const blob = new Blob([editorContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${playlistName.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "playlist"}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`Exported playlist "${playlistName}" as file download.`, "info");
  };

  // Clean Export Option: strips dead or invalid links (non-http/https) and dead comments
  const handleCleanExportM3U = () => {
    const lines = editorContent.split("\n");
    const cleanedLines: string[] = [];
    
    // Force EXTM3U header
    cleanedLines.push("#EXTM3U");
    
    let currentExtInf: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith("#EXTM3U")) {
        continue;
      }
      if (line.startsWith("#EXTINF:")) {
        currentExtInf = line;
      } else if (line.length > 0 && !line.startsWith("#")) {
        // Only permit http or https stream URLs
        if (line.startsWith("http://") || line.startsWith("https://")) {
          if (currentExtInf) {
            cleanedLines.push(currentExtInf);
          }
          cleanedLines.push(line);
        }
        currentExtInf = null; // reset
      }
    }

    const cleanedContent = cleanedLines.join("\n");
    const blob = new Blob([cleanedContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${playlistName.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "playlist"}_cleaned.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`Sanitized and exported clean playlist "${playlistName}" to filter non-compatible players.`, "info");
    alert(`Clean export completed! Invalid protocols and dead header noise filtered out.`);
  };

  // Delete a playlist entirely from Vault
  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the playlist "${name}" and all of its associated channels from the TV Guide?`)) {
      return;
    }
    try {
      await PlaylistVault.removePlaylist(id);
      if (selectedPlaylist && selectedPlaylist.id === id) {
        setSelectedPlaylist(null);
        setEditorContent("");
      }
      await reloadVault();
      addLog(`Deleted playlist "${name}" and removed all associated channels.`, "info");
    } catch (err: any) {
      addLog(`Failed to delete playlist: ${err.message}`, "error");
    }
  };

  // Save changes to current or new playlist
  const handleSavePlaylist = async () => {
    if (!playlistName.trim()) {
      alert("Please provide a valid name for this playlist.");
      return;
    }

    try {
      const parsedChannels = await parseM3UPlaylistAsync(editorContent, selectedPlaylist?.url);
      if (parsedChannels.length === 0) {
        alert("The editor content contains no valid channels. Make sure you use the standard #EXTM3U format!");
        return;
      }

      const activeId = isNewPlaylist ? `pl-${Date.now()}` : selectedPlaylist!.id;
      
      // Load previous playlist state to preserve or update history
      let existingPlaylist: M3UPlaylist | null = null;
      if (!isNewPlaylist) {
        existingPlaylist = await PlaylistVault.getPlaylist(activeId);
      }

      // Prepare previous state for history rolling queue (max 10 items)
      const newHistory: M3UPlaylistVersion[] = existingPlaylist?.history || [];
      if (existingPlaylist && existingPlaylist.content && existingPlaylist.content !== editorContent) {
        const pastVersion: M3UPlaylistVersion = {
          versionId: `v-${Date.now()}`,
          timestamp: existingPlaylist.importedAt || new Date().toISOString(),
          checksum: existingPlaylist.checksum || "none",
          content: existingPlaylist.content,
          channelCount: existingPlaylist.channelCount || 0
        };
        newHistory.unshift(pastVersion);
        if (newHistory.length > 10) {
          newHistory.pop(); // Keep only last 10 versions
        }
      }

      // Checksum simulation
      const simpleHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
      };
      const computedChecksum = "chsum_" + simpleHash(editorContent);

      // Save channels to database
      // First, if editing, remove the old channels associated with the old content of this playlist
      if (existingPlaylist && existingPlaylist.content) {
        const oldParsed = await parseM3UPlaylistAsync(existingPlaylist.content, existingPlaylist.url);
        for (const oldCh of oldParsed) {
          if (oldCh.url) {
            await PlaylistVault.removeChannel(oldCh.url);
          }
        }
      }

      // Add the newly parsed channels
      await PlaylistVault.addAndSyncChannels(parsedChannels);

      // Create playlist object
      const playlistMeta: M3UPlaylist = {
        id: activeId,
        name: playlistName,
        content: editorContent,
        importedAt: new Date().toISOString(),
        channelCount: parsedChannels.length,
        checksum: computedChecksum,
        isCustom: true,
        history: newHistory
      };

      await PlaylistVault.savePlaylist(playlistMeta);
      
      setSelectedPlaylist(playlistMeta);
      setIsNewPlaylist(false);
      
      await reloadVault();
      
      addLog(`Saved playlist "${playlistName}" containing ${parsedChannels.length} channels. Synced seamlessly with TV Guide.`, "info");
      alert(`Playlist "${playlistName}" saved successfully! TV Guide updated with ${parsedChannels.length} channels.`);
    } catch (err: any) {
      addLog(`Error saving playlist: ${err.message}`, "error");
      alert(`Error saving playlist: ${err.message}`);
    }
  };

  // Rollback to previous version from history
  const handleRollbackVersion = async (version: M3UPlaylistVersion) => {
    if (!selectedPlaylist) return;
    if (!window.confirm(`Are you sure you want to rollback to the version from ${new Date(version.timestamp).toLocaleString()}? This will restore ${version.channelCount} channels.`)) {
      return;
    }

    try {
      // De-sync current channels
      if (selectedPlaylist.content) {
        const oldParsed = await parseM3UPlaylistAsync(selectedPlaylist.content, selectedPlaylist.url);
        for (const oldCh of oldParsed) {
          if (oldCh.url) {
            await PlaylistVault.removeChannel(oldCh.url);
          }
        }
      }

      // Save rolled back channels
      const newParsed = await parseM3UPlaylistAsync(version.content, selectedPlaylist.url);
      await PlaylistVault.addAndSyncChannels(newParsed);

      // Build new history: push current state to history first
      const currentHistory = selectedPlaylist.history || [];
      const pastVersion: M3UPlaylistVersion = {
        versionId: `v-${Date.now()}`,
        timestamp: selectedPlaylist.importedAt,
        checksum: selectedPlaylist.checksum || "none",
        content: selectedPlaylist.content || "",
        channelCount: selectedPlaylist.channelCount
      };

      // Filter out the selected rollback target from the past history to keep history clean, then insert current
      const filteredHistory = currentHistory.filter(h => h.versionId !== version.versionId);
      filteredHistory.unshift(pastVersion);

      const rolledPlaylist: M3UPlaylist = {
        ...selectedPlaylist,
        content: version.content,
        channelCount: version.channelCount,
        checksum: version.checksum,
        importedAt: new Date().toISOString(),
        history: filteredHistory
      };

      await PlaylistVault.savePlaylist(rolledPlaylist);
      setSelectedPlaylist(rolledPlaylist);
      
      // Load content and clear stack
      isInternalChangeRef.current = true;
      setEditorContent(version.content);
      setUndoStack([]);
      setRedoStack([]);
      
      await reloadVault();
      addLog(`Successfully rolled back playlist "${selectedPlaylist.name}" to historical version.`, "info");
      alert(`Playlist rolled back successfully! restored ${version.channelCount} channels.`);
    } catch (err: any) {
      addLog(`Rollback failed: ${err.message}`, "error");
      alert(`Rollback failed: ${err.message}`);
    }
  };

  // Visual Theme Variables targeting desaturated tones
  const containerStyle = theme === "light"
    ? "bg-[#F8F9FA] border-[#E4E7EB] text-[#2D3139]"
    : "bg-[#131722] border-slate-800/60 text-slate-100";

  const panelStyle = theme === "light"
    ? "bg-white border-[#E4E7EB]"
    : "bg-[#1A202C] border-slate-800/80";

  const editorBlockStyle = theme === "light"
    ? "bg-[#F1F3F5] border-[#DDE1E5]"
    : "bg-[#0F131E] border-slate-800/80";

  const inputStyle = theme === "light"
    ? "bg-[#F1F3F5] border-[#DDE1E5] text-[#2D3139] focus:border-blue-500"
    : "bg-[#0B0E14] border-slate-800 text-slate-200 focus:border-blue-500";

  return (
    <div className={`rounded-2xl border p-6 space-y-6 shadow-xl ${containerStyle}`}>
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800/20 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-blue-500 font-black block">Playlist Vault Manager</span>
          <h2 className="text-base font-black uppercase flex items-center gap-2 font-sans">
            <Code className="w-5 h-5 text-blue-400" />
            <span>Open, Edit, & Save Playlist Files</span>
          </h2>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleInitNewPlaylist}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Create a blank playlist skeleton"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Playlist</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        
        {/* LEFT COLUMN: Playlists List & Registry (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-400 font-mono flex items-center justify-between border-b border-slate-800/20 pb-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-slate-500" />
              <span>Vault Registry ({playlists.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setLayoutMode("list")} 
                className={`p-1 rounded transition-colors ${layoutMode === "list" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setLayoutMode("grid")} 
                className={`p-1 rounded transition-colors ${layoutMode === "grid" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </h3>

          {/* Quick Find Toolbar */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="Quick find lists..."
                className="w-full pl-9 pr-3 py-1.5 rounded-full text-xs font-mono outline-none border border-slate-800/60 focus:border-blue-500 bg-black/40 text-slate-200 shadow-inner"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono bg-black/20 p-1.5 rounded-lg border border-slate-800/30">
              <span className="text-slate-500 px-1">Sort by:</span>
              <div className="flex bg-black/40 rounded p-0.5 border border-slate-800/50">
                {[ 
                  { id: "date", label: "Date Added" }, 
                  { id: "alpha", label: "A-Z" }, 
                  { id: "size", label: "Size" } 
                ].map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setVaultSort(opt.id as any)}
                    className={`px-2 py-0.5 rounded transition-colors ${vaultSort === opt.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto max-h-[540px] space-y-4 pr-1 scrollbar-thin">
            {playlists.length === 0 ? (
              <div className={`p-8 text-center border border-dashed border-slate-800/60 rounded-2xl ${panelStyle} text-slate-500 font-mono text-[10px]`}>
                No playlists in Vault yet. Paste a link or upload an M3U file above to register.
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {[ 
                  { title: "Pinned Feeds", items: processedPlaylists.pinned, icon: <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />, key: "pinned", forceExpand: true },
                  { title: "Archives", items: processedPlaylists.archives, icon: <FolderOpen className="w-3.5 h-3.5 text-blue-400" />, key: "archives", forceExpand: false },
                  { title: "Defaults", items: processedPlaylists.defaults, icon: <FolderOpen className="w-3.5 h-3.5 text-slate-400" />, key: "defaults", forceExpand: false },
                  { title: "Custom Uploads", items: processedPlaylists.custom, icon: <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />, key: "custom", forceExpand: false }
                ].map(section => {
                  if (section.items.length === 0) return null;
                  const isExpanded = section.forceExpand || expandedFolders[section.key];
                  const itemContainerClass = layoutMode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2";
                  return (
                    <div key={section.key} className="space-y-2">
                      <div 
                        className="flex items-center justify-between cursor-pointer group select-none"
                        onClick={() => !section.forceExpand && toggleFolder(section.key)}
                      >
                        <div className="flex items-center gap-2">
                          {section.icon}
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">{section.title}</h4>
                          <span className="text-[9px] font-mono bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-400">{section.items.length}</span>
                        </div>
                        {!section.forceExpand && (
                          <div className="text-slate-500 group-hover:text-slate-300">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        )}
                      </div>
                      
                      {isExpanded && (
                        <div className={itemContainerClass}>
                          {section.items.map(pl => {
                            const isCurrent = selectedPlaylist?.id === pl.id;
                            const isPinned = pinnedIds.includes(pl.id);
                            if (layoutMode === "grid") {
                              return (
                                <div
                                  key={pl.id}
                                  onClick={() => handleSelectPlaylist(pl)}
                                  className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none h-[90px] relative group ${
                                    isCurrent
                                      ? "bg-blue-900/10 border-blue-500/50 shadow-md"
                                      : `${panelStyle} hover:bg-slate-800/10 hover:border-slate-700/60`
                                  }`}
                                >
                                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => togglePin(pl.id, e)}
                                      className={`p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800`}
                                    >
                                      <Star className={`w-3 h-3 ${isPinned ? "fill-amber-400 text-amber-400" : ""}`} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePlaylist(pl.id, pl.name);
                                      }}
                                      className="p-1 rounded text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="flex flex-col mt-1 pr-6">
                                    <h4 className="text-[10px] font-bold uppercase line-clamp-2 leading-tight">{pl.name}</h4>
                                  </div>
                                  <div className="flex items-center justify-between border-t border-slate-800/30 pt-1.5 mt-auto text-[8.5px] font-mono text-slate-500">
                                    <span>{pl.channelCount} CH</span>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={pl.id}
                                onClick={() => handleSelectPlaylist(pl)}
                                className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none group ${
                                  isCurrent
                                    ? "bg-blue-900/10 border-blue-500/50 shadow-md shadow-blue-900/5"
                                    : `${panelStyle} hover:bg-slate-800/10 hover:border-slate-700/60`
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-black/40 text-blue-400 border border-slate-800/50 rounded font-bold uppercase tracking-wider">
                                      M3U File
                                    </span>
                                    <h4 className="text-xs font-bold uppercase truncate mt-1">{pl.name}</h4>
                                    {pl.url ? (
                                      <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5" title={pl.url}>
                                        URL: {pl.url}
                                      </p>
                                    ) : (
                                      <p className="text-[9px] font-mono text-slate-500 mt-0.5">Local Uploaded / Custom</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => togglePin(pl.id, e)}
                                      className={`p-1.5 rounded-xl transition-all cursor-pointer ${isPinned ? "text-amber-400 bg-amber-400/10" : "text-slate-500 hover:bg-slate-700/50"}`}
                                      title="Pin to Top"
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isPinned ? "fill-amber-400" : ""}`} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePlaylist(pl.id, pl.name);
                                      }}
                                      className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-xl text-slate-500 transition-all cursor-pointer"
                                      title="Delete from Vault"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/30 text-[9px] font-mono text-slate-500">
                                  <span>{pl.channelCount} Channels</span>
                                  <span>{new Date(pl.importedAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Code Editor (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/20 pb-2">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-400" />
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Playlist Title..."
                className="bg-transparent text-sm font-bold uppercase outline-none border-b border-transparent focus:border-blue-500 px-1 py-0.5 font-mono text-white"
              />
              {isNewPlaylist && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  NEW TEMPLATE
                </span>
              )}
            </div>

            <div className="text-[10px] font-mono text-slate-400">
              ⚡ Live Verification: <span className="text-emerald-400 font-bold">{parsedChannelsCount} Channels</span>
            </div>
          </div>

          {/* Quick Search & Replace bar inside editor box */}
          <div className={`p-3 rounded-xl border flex flex-wrap items-center gap-3 ${panelStyle}`}>
            <div className="relative flex-1 min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find in M3U..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none font-mono ${inputStyle}`}
              />
              {searchQuery && (
                <span className="absolute right-2.5 top-1.5 text-[9px] font-mono text-slate-400 font-bold bg-slate-900 border border-slate-800/80 px-1 py-0.5 rounded">
                  {searchMatchesCount} matches
                </span>
              )}
            </div>

            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className={`flex-1 min-w-[150px] px-3 py-1.5 rounded-lg text-[11px] outline-none font-mono ${inputStyle}`}
            />

            <button
              onClick={handleReplaceAll}
              disabled={!searchQuery}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                searchQuery
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  : "bg-slate-900/50 text-slate-600 cursor-not-allowed border border-transparent"
              }`}
            >
              Replace All
            </button>
          </div>

          {/* Editor Header: Undo, Redo, Code utilities */}
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  undoStack.length > 0
                    ? "bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300"
                    : "opacity-40 cursor-not-allowed border-transparent text-slate-600"
                }`}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono">Undo</span>
              </button>

              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  redoStack.length > 0
                    ? "bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300"
                    : "opacity-40 cursor-not-allowed border-transparent text-slate-600"
                }`}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono">Redo</span>
              </button>
            </div>

            <div className="text-[9.5px] font-mono text-slate-500">
              Stack: {undoStack.length} undo / {redoStack.length} redo
            </div>
          </div>

          {/* Dual-Pane Code Input Block with Line Numbers */}
          <div className={`flex rounded-2xl border overflow-hidden relative font-mono text-[11px] min-h-[300px] ${editorBlockStyle}`}>
            {/* Scrollable line numbers bar (scrolled in sync) */}
            <div 
              ref={lineNumbersRef}
              className="w-10 bg-[#0C101B]/80 border-r border-slate-800/80 select-none text-right py-3.5 pr-2.5 text-slate-600 overflow-hidden h-[340px]"
            >
              {lineNumbersArray.map((line) => (
                <div key={line} className="h-[18px] leading-[18px]">
                  {line}
                </div>
              ))}
            </div>

            {/* Custom raw TextArea Input with Undo/Redo tracking */}
            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => handleEditorChange(e.target.value)}
              onScroll={handleScroll}
              placeholder="#EXTM3U..."
              className="flex-1 min-h-0 h-[340px] px-4 py-3.5 outline-none bg-transparent text-slate-300 resize-none font-mono text-[11px] leading-[18px] select-text overflow-y-auto"
              style={{ whiteSpace: "pre", wordWrap: "normal" }}
            />
          </div>

          {/* REAL-TIME SYNTAX HEALTH INSPECTOR */}
          <div className={`p-4 rounded-2xl border space-y-2.5 ${panelStyle}`}>
            <h4 className="text-[10px] font-black uppercase text-slate-400 font-mono flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>M3U Syntax Health Inspector ({validationErrors.length} issues)</span>
            </h4>

            {validationErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-[10.5px] font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Excellent! No syntax conflicts, duplicate tvg-id values, or non-compatible stream protocols found.</span>
              </div>
            ) : (
              <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                {validationErrors.map((err, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      err.type === "error" 
                        ? "bg-red-500/5 border-red-500/10 text-red-400" 
                        : "bg-amber-500/5 border-amber-500/10 text-amber-400"
                    }`}
                  >
                    <span className="font-bold underline">Line {err.line}:</span>
                    <span className="flex-1">{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Channel Inline Drawer */}
          <div className="space-y-2">
            <button
              onClick={() => setShowChannelForm(prev => !prev)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>{showChannelForm ? "Hide Channel Form" : "Add New Channel to this Playlist"}</span>
            </button>

            <AnimatePresence>
              {showChannelForm && (
                <motion.form key="showChannelForm-anim-1"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAppendChannel}
                  className={`p-4 rounded-2xl border space-y-3 overflow-hidden ${panelStyle}`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">Channel Name *</label>
                      <input
                        type="text"
                        required
                        value={newChanName}
                        onChange={(e) => setNewChanName(e.target.value)}
                        placeholder="e.g. Patriot News Live"
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">Stream URL (HLS / MP4) *</label>
                      <input
                        type="text"
                        required
                        value={newChanUrl}
                        onChange={(e) => setNewChanUrl(e.target.value)}
                        placeholder="https://..."
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">Group / Category</label>
                      <input
                        type="text"
                        value={newChanGroup}
                        onChange={(e) => setNewChanGroup(e.target.value)}
                        placeholder="e.g. News Broadcasts"
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">EPG / tvg-id</label>
                      <input
                        type="text"
                        value={newChanTvgId}
                        onChange={(e) => setNewChanTvgId(e.target.value)}
                        placeholder="e.g. news-patriot-live"
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">Logo Image URL</label>
                      <input
                        type="text"
                        value={newChanLogo}
                        onChange={(e) => setNewChanLogo(e.target.value)}
                        placeholder="https://image-link.png"
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-500 uppercase font-black">Channel Number</label>
                      <input
                        type="text"
                        value={newChanChno}
                        onChange={(e) => setNewChanChno(e.target.value)}
                        placeholder="e.g. 05"
                        className={`w-full px-3 py-2 rounded-lg outline-none ${inputStyle}`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      Append Channel Info
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/20">
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadM3U}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Download editor contents as local .m3u file"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Export M3U</span>
              </button>

              <button
                onClick={handleCleanExportM3U}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Clean and strip dead URLs and non-compatible lines"
              >
                <FileDown className="w-4 h-4" />
                <span>Clean & Export</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {selectedPlaylist && (
                <button
                  onClick={() => {
                    isInternalChangeRef.current = true;
                    setEditorContent(selectedPlaylist.content || "");
                    setPlaylistName(selectedPlaylist.name);
                    setUndoStack([]);
                    setRedoStack([]);
                    addLog("Discarded editor changes, reloaded saved file.", "info");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-900 text-xs text-slate-500 hover:text-slate-300 font-mono transition-all cursor-pointer"
                >
                  Discard Changes
                </button>
              )}
              
              <button
                onClick={handleSavePlaylist}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all shadow-lg hover:shadow-blue-600/30 active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save & Sync TV Guide</span>
              </button>
            </div>
          </div>
          
          {/* HISTORY TIMELINE DRAWER */}
          {selectedPlaylist && selectedPlaylist.history && selectedPlaylist.history.length > 0 && (
            <div className="p-5 rounded-2xl bg-blue-950/5 border border-blue-500/10 space-y-4">
              <h3 className="text-xs font-black uppercase text-blue-400 font-mono flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Playlist Revision History (Load from History)</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                {selectedPlaylist.history.map((ver, i) => (
                  <div 
                    key={ver.versionId}
                    className="p-3 rounded-xl bg-black/20 border border-slate-800/60 flex items-center justify-between gap-3 text-left font-mono"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-300 block">
                        Revision #{selectedPlaylist.history!.length - i}
                      </span>
                      <span className="text-[8.5px] text-slate-500 block mt-0.5">
                        {new Date(ver.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-blue-400 block mt-1 font-black">
                        {ver.channelCount} Channels
                      </span>
                    </div>

                    <button
                      onClick={() => handleRollbackVersion(ver)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase transition-all cursor-pointer"
                    >
                      Rollback
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
