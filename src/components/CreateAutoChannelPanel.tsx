import { safeLocalStorage } from "../utils/safeStorage";
import React, { useState, useRef, useEffect } from "react";
import { Folder, Film, FileText, ToggleLeft, ToggleRight, Sparkles, AlertCircle, Play, CheckCircle, Trash2, Shuffle, Layers, RefreshCw } from "lucide-react";

const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://ajn-archive-iptv-player-382115576551.us-west2.run.app');


interface IngestedTrack {
  id: string;
  title: string;
  durationInSeconds: number;
  url: string;
  sourceType: "local" | "remote";
  fileName: string;
}

interface CreateAutoChannelPanelProps {
  onChannelCreated: () => void;
  addLog?: (msg: string) => void;
}

export function CreateAutoChannelPanel({ onChannelCreated, addLog }: CreateAutoChannelPanelProps) {
  const [channelName, setChannelName] = useState("");
  const [channelNum, setChannelNum] = useState<number>(99);
  const [behavior, setBehavior] = useState<"binge" | "shuffle" | "syndication">("binge");
  const [isDragging, setIsDragging] = useState(false);
  const [tracks, setTracks] = useState<IngestedTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [accentColor, setAccentColor] = useState("from-violet-600 to-indigo-600");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique Channel ID
  const channelIdRef = useRef(`drop-go-${Math.random().toString(36).substring(2, 9)}`);

  // Programmatically inject directory attributes to circumvent React standard typing constraints
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("webkitdirectory", "");
      fileInputRef.current.setAttribute("directory", "");
    }
  }, []);

  // Accent options for default color-coded logo
  const accentOptions = [
    { name: "Violet", value: "from-violet-600 to-indigo-600", text: "text-violet-400" },
    { name: "Emerald", value: "from-emerald-500 to-teal-600", text: "text-emerald-400" },
    { name: "Amber", value: "from-amber-500 to-orange-600", text: "text-amber-400" },
    { name: "Rose", value: "from-rose-500 to-pink-600", text: "text-rose-400" },
    { name: "Cyan", value: "from-cyan-500 to-blue-600", text: "text-cyan-400" }
  ];

  // Pass 2: Ingest & Sanitization Pipeline (Silent Metadata Extraction)
  const cleanTitle = (filename: string): string => {
    let title = filename.split(/[/\\]/).pop() || filename;

    const extensions = [
      /\.mp4$/i, /\.mkv$/i, /\.ts$/i, /\.m3u8$/i, /\.avi$/i, /\.flv$/i, 
      /\.webm$/i, /\.mov$/i, /\.wmv$/i, /\.mpg$/i, /\.mpeg$/i, /\.m4v$/i, 
      /\.mp3$/i, /\.wav$/i, /\.ogg$/i, /\.flac$/i, /\.m3u$/i
    ];
    for (const ext of extensions) {
      title = title.replace(ext, "");
    }

    // Strip non-English / non-ASCII characters
    title = title.replace(/[^\x20-\x7E]/g, "");

    // Strip common tracker tags
    const trackerTags = [
      /\[\s*1080p\s*\]/gi, /\(\s*1080p\s*\)/gi, /\b1080p\b/gi,
      /\[\s*720p\s*\]/gi, /\(\s*720p\s*\)/gi, /\b720p\b/gi,
      /\[\s*480p\s*\]/gi, /\(\s*480p\s*\)/gi, /\b480p\b/gi,
      /\[\s*4k\s*\]/gi, /\(\s*4k\s*\)/gi, /\b4k\b/gi,
      /\[\s*YTS\s*\]/gi, /\[\s*YIFY\s*\]/gi, /\[\s*EZTV\s*\]/gi, /\[\s*RARBG\s*\]/gi,
      /\[\s*ENG\s*\]/gi, /\[\s*ENG[-_]SUB\s*\]/gi, /\bENG[-_]SUB\b/gi,
      /\[\s*HEVC\s*\]/gi, /\bx264\b/gi, /\bx265\b/gi, /\bh264\b/gi, /\bh265\b/gi,
      /\[\s*[a-f0-9]{8}\s*\]/gi,
      /\bhdr\b/gi, /\bweb[-_]dl\b/gi, /\bwebrip\b/gi, /\bbluray\b/gi, /\bxvid\b/gi
    ];
    for (const tag of trackerTags) {
      title = title.replace(tag, "");
    }

    // Replace underscores, hyphens, and multiple dots with single space
    title = title.replace(/[_\.\-+]+/g, " ");
    title = title.replace(/\s+/g, " ").trim();

    // Standard broadcast title casing
    return title.replace(/\b\w/g, c => c.toUpperCase()) || "Clean Auto Track";
  };

  // Extract file duration programmatically via a temporary hidden video element
  const getFileDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("audio/") || file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".m4v") || file.name.endsWith(".mp3")) {
        const video = document.createElement("video");
        video.preload = "metadata";
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        
        const timeout = setTimeout(() => {
          resolve(1800); // fallback of 30 mins
          URL.revokeObjectURL(objectUrl);
        }, 3000);

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve(video.duration && video.duration > 0 ? Math.round(video.duration) : 1800);
          URL.revokeObjectURL(objectUrl);
        };

        video.onerror = () => {
          clearTimeout(timeout);
          resolve(1800); // fallback
          URL.revokeObjectURL(objectUrl);
        };
      } else {
        resolve(1800); // default
      }
    });
  };

  const processFileList = async (files: File[]) => {
    setIsProcessing(true);
    setErrorMsg("");
    setStatusMsg(`Sanitizing and processing ${files.length} files...`);

    const newTracks: IngestedTrack[] = [];

    for (const file of files) {
      try {
        // Parse M3U / M3U8 list if dropped
        if (file.name.endsWith(".m3u") || file.name.endsWith(".m3u8")) {
          const text = await file.text();
          const lines = text.split(/\r?\n/);
          let tempExtinf = "";
          let extinfDuration = 1800;

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.startsWith("#EXTINF:")) {
              tempExtinf = line;
              const match = line.match(/#EXTINF:\s*(-?\d+(?:\.\d+)?)/i);
              if (match) {
                const parsedDur = Math.round(parseFloat(match[1]));
                extinfDuration = parsedDur > 0 ? parsedDur : 1800;
              }
            } else if (line && !line.startsWith("#")) {
              const url = line;
              let title = "";
              if (tempExtinf) {
                const commaIdx = tempExtinf.indexOf(",");
                if (commaIdx !== -1) {
                  title = tempExtinf.substring(commaIdx + 1).trim();
                }
              }
              if (!title) {
                const parts = url.split("/");
                title = parts[parts.length - 1] || "Remote Stream";
              }

              const cleanName = cleanTitle(title);
              newTracks.push({
                id: `track-${Math.random().toString(36).substring(2, 9)}`,
                title: cleanName,
                durationInSeconds: extinfDuration,
                url: url,
                sourceType: "remote",
                fileName: title
              });
              tempExtinf = "";
              extinfDuration = 1800;
            }
          }
        } else {
          // Standard MP4 or media file
          const cleanName = cleanTitle(file.name);
          const duration = await getFileDuration(file);
          // Standard browser local URL creation
          const objectUrl = URL.createObjectURL(file);

          newTracks.push({
            id: `track-${Math.random().toString(36).substring(2, 9)}`,
            title: cleanName,
            durationInSeconds: duration,
            url: objectUrl,
            sourceType: "local",
            fileName: file.name
          });
        }
      } catch (err: any) {
        console.error("Failed to process file:", file.name, err);
      }
    }

    if (newTracks.length > 0) {
      setTracks((prev) => [...prev, ...newTracks]);
      setStatusMsg(`Successfully ingested and sanitized ${newTracks.length} media tracks.`);
      if (addLog) addLog(`Auto-Ingest Pipeline: Sanitized and registered ${newTracks.length} media files to channel queue.`);
    } else {
      setErrorMsg("No playable media files, M3U streams, or MP4s were detected.");
    }
    setIsProcessing(false);
  };

  // Traverses filesystem folders recursively
  const traverseDirectory = async (entry: FileSystemEntry): Promise<File[]> => {
    const files: File[] = [];
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
      if (file.name.endsWith(".mp4") || file.name.endsWith(".m4v") || file.name.endsWith(".mp3") || file.name.endsWith(".m3u") || file.name.endsWith(".m3u8")) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      
      const readAllEntries = async (): Promise<FileSystemEntry[]> => {
        const allEntries: FileSystemEntry[] = [];
        const readBatch = (): Promise<FileSystemEntry[]> => {
          return new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
        };
        
        let batch = await readBatch();
        while (batch.length > 0) {
          allEntries.push(...batch);
          batch = await readBatch();
        }
        return allEntries;
      };

      const entries = await readAllEntries();
      for (const childEntry of entries) {
        const childFiles = await traverseDirectory(childEntry);
        files.push(...childFiles);
      }
    }
    return files;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg("");

    const items = e.dataTransfer.items;
    const standardFiles = Array.from(e.dataTransfer.files);

    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function") {
      // Modern directory drop support
      const filePromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry();
        if (entry) {
          filePromises.push(traverseDirectory(entry));
        }
      }
      setIsProcessing(true);
      setStatusMsg("Scanning folders recursively...");
      try {
        const resolvedFilesArrays = await Promise.all(filePromises);
        const allFiles = resolvedFilesArrays.flat();
        if (allFiles.length > 0) {
          await processFileList(allFiles);
        } else {
          // Fallback to standard files if no matching file types in entry scanning
          await processFileList(standardFiles.filter(f => f.name.endsWith(".mp4") || f.name.endsWith(".m4v") || f.name.endsWith(".mp3") || f.name.endsWith(".m3u") || f.name.endsWith(".m3u8")));
        }
      } catch (err: any) {
        setErrorMsg("Error scanning folder entries recursively: " + err.message);
        setIsProcessing(false);
      }
    } else {
      // Traditional file drop support
      await processFileList(standardFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length > 0) {
      processFileList(selectedFiles);
    }
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter(t => t.id !== id));
  };

  const clearAllTracks = () => {
    setTracks([]);
    setErrorMsg("");
    setStatusMsg("");
  };

  // Phase 3 & 4: Create & Inject Auto-Channel with deterministic seed logic and the "Broadcast Wheel" Engine
  const handleSaveChannel = async () => {
    if (tracks.length === 0) {
      setErrorMsg("Please ingest at least one media track or stream before saving.");
      return;
    }

    const finalName = channelName.trim() || `CH ${channelNum}: Auto-Generated Feed`;
    setIsSaving(true);
    setErrorMsg("");

    try {
      // Playout behavior alignment: sort, shuffle, or syndicate
      let orderedTracks = [...tracks];
      if (behavior === "shuffle") {
        orderedTracks.sort(() => Math.random() - 0.5);
      } else if (behavior === "syndication") {
        // Alternate between multiple tracks (interleaving)
        // Group tracks by some text-based identifier or name prefix and interleave them
        const showGroups: Record<string, IngestedTrack[]> = {};
        orderedTracks.forEach(t => {
          // Crude show detector: first word of sanitized title
          const showWord = t.title.split(" ")[0] || "Default";
          if (!showGroups[showWord]) showGroups[showWord] = [];
          showGroups[showWord].push(t);
        });

        const groupsArray = Object.values(showGroups);
        const syndicated: IngestedTrack[] = [];
        let maxLen = Math.max(...groupsArray.map(g => g.length));

        for (let i = 0; i < maxLen; i++) {
          for (const grp of groupsArray) {
            if (grp[i]) {
              syndicated.push(grp[i]);
            }
          }
        }
        orderedTracks = syndicated;
      }

      // 24h programming block expansion (Wheel Playout)
      let wheelEpisodes = orderedTracks.map((t, idx) => ({
        id: t.id,
        title: t.title,
        durationInSeconds: t.durationInSeconds,
        url: t.url,
        thumbnail: "https://archive.org/download/daily-highlights/lmbsa.png",
        plot: `Automated Playout Slot #${idx + 1}. Behavior: ${behavior.toUpperCase()}`,
        genre: "Auto Variety",
        rating: "TV-G"
      }));

      let totalDuration = wheelEpisodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);

      // Repeat sequentially to satisfy Phase 3's "Broadcast Wheel" engine
      if (totalDuration > 0) {
        let loopCounter = 1;
        const baseEpisodes = [...wheelEpisodes];
        while (totalDuration < 86400) { // 24 hours
          wheelEpisodes = [
            ...wheelEpisodes,
            ...baseEpisodes.map(ep => ({
              ...ep,
              id: `${ep.id}-loop-${loopCounter}`,
              plot: `Automated Playout Slot (Loop ${loopCounter}). Behavior: ${behavior.toUpperCase()}`
            }))
          ];
          loopCounter++;
          totalDuration = wheelEpisodes.reduce((acc, ep) => acc + ep.durationInSeconds, 0);
        }
      }

      // POST to backend SQLite-like JSON store
      const response = await fetch(BACKEND_URL + "/api/ajn-custom-auto-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: channelIdRef.current,
          num: channelNum,
          name: finalName,
          logo: `gradient:${accentColor}`, // save accent code as logo indicator
          behavior,
          episodes: wheelEpisodes,
          staggerOffsetSeconds: Math.floor(Math.random() * 3600) // random deterministic stagger
        })
      });

      if (response.ok) {
        // Also save to client's localStorage to allow direct EPG sync
        const customAutoChannelsStr = safeLocalStorage.getItem("ajn_drop_go_channels");
        let customAutoChannels = [];
        if (customAutoChannelsStr) {
          try {
            customAutoChannels = JSON.parse(customAutoChannelsStr);
          } catch {}
        }
        
        const newChan = {
          id: channelIdRef.current,
          num: channelNum,
          name: finalName,
          logo: `gradient:${accentColor}`,
          url: wheelEpisodes[0]?.url || "",
          behavior,
          episodes: wheelEpisodes,
          totalLoopDurationInSeconds: totalDuration,
          staggerOffsetSeconds: Math.floor(Math.random() * 3600),
          isPermanent: true
        };

        // Filter out duplicate IDs
        customAutoChannels = customAutoChannels.filter((c: any) => c.id !== channelIdRef.current);
        customAutoChannels.push(newChan);
        safeLocalStorage.setItem("ajn_drop_go_channels", JSON.stringify(customAutoChannels));

        // Dispatch browser synchronization event to force instantaneous EPG recalculation
        window.dispatchEvent(new CustomEvent("ajn-multiplexer-updated"));
        window.dispatchEvent(new CustomEvent("ajn_auto_channels_updated"));

        if (addLog) addLog(`Broadcast Wheel: Dynamically repeated custom playlist to compile a 24-hour playout block. Assigned CH ${channelNum}: ${finalName}.`);

        setStatusMsg("Channel created successfully! Injecting EPG guide slots instantly...");
        onChannelCreated();

        // Reset
        setChannelName("");
        setChannelNum(prev => prev + 1);
        setTracks([]);
        channelIdRef.current = `drop-go-${Math.random().toString(36).substring(2, 9)}`;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server failed to save channel.");
      }
    } catch (err: any) {
      setErrorMsg(`Failed to save auto-channel: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalTracksDuration = tracks.reduce((acc, t) => acc + t.durationInSeconds, 0);
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  };

  return (
    <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-3xl p-6 shadow-2xl transition-all duration-300">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-semibold tracking-tight text-white">Create Auto-Channel</h2>
          </div>
          <p className="text-xs text-slate-400">
            Drop in your media files or playlist links. The engine will automatically compile an infinite 24-hour playout wheel.
          </p>
        </div>
        
        {/* Accent Selector for default logo */}
        <div className="flex items-center gap-2 bg-slate-950/40 p-2 rounded-2xl border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 pl-1">Logo Theme:</span>
          <div className="flex gap-1.5">
            {accentOptions.map((opt) => (
              <button
                key={opt.name}
                onClick={() => setAccentColor(opt.value)}
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${opt.value} border-2 transition-transform hover:scale-110 ${accentColor === opt.value ? "border-white scale-105 shadow-md" : "border-transparent"}`}
                title={opt.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Setup & Files */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Channel Label</label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. Action Classics Hour"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Virtual CH Number</label>
              <input
                type="number"
                value={channelNum}
                onChange={(e) => setChannelNum(parseInt(e.target.value) || 99)}
                min="1"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* One-Click Presets Toggle */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Playout Presets Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "binge", label: "Binge Mode", desc: "Sequential playout", icon: Layers, activeColor: "border-indigo-500 bg-indigo-500/15 text-indigo-300" },
                { id: "shuffle", label: "Shuffle Mode", desc: "Randomized queue", icon: Shuffle, activeColor: "border-emerald-500 bg-emerald-500/15 text-emerald-300" },
                { id: "syndication", label: "Syndication", desc: "Rotating shows", icon: RefreshCw, activeColor: "border-amber-500 bg-amber-500/15 text-amber-300" }
              ].map((opt) => {
                const Icon = opt.icon;
                const isActive = behavior === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBehavior(opt.id as any)}
                    className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all ${
                      isActive ? opt.activeColor : "border-slate-800 bg-slate-950/20 text-slate-400 hover:bg-slate-900/30"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drop-Zone Panel */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
              isDragging 
                ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                : "border-slate-700 hover:border-indigo-500/50 hover:bg-slate-900/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3">
                <Folder className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-white mb-1">Drag and Drop Local Folders or MP4s</span>
              <span className="text-xs text-slate-400 mb-2">Or drop raw .M3U / .M3U8 playlists</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">Browse Folder</span>
            </div>
          </div>

          {/* Action Log / Status */}
          {statusMsg && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-emerald-400 animate-fadeIn">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 text-xs text-rose-400 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-xs text-indigo-400">
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>Processing files...</span>
            </div>
          )}

        </div>

        {/* Right Side: Ingested Tracks List */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-[300px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ingested Queue ({tracks.length})</span>
            {tracks.length > 0 && (
              <button
                onClick={clearAllTracks}
                className="text-slate-500 hover:text-rose-400 transition-colors"
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto max-h-[310px] space-y-2 scrollbar-thin">
            {tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                <Film className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-xs">No tracks registered yet.</span>
              </div>
            ) : (
              tracks.map((track, idx) => (
                <div key={track.id} className="group flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-800/50 hover:border-slate-700 rounded-xl p-2.5 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold font-mono text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate" title={track.title}>{track.title}</p>
                      <span className="text-[9px] text-slate-400">{formatTime(track.durationInSeconds)} • {track.sourceType === "local" ? "Local file" : "Remote IPTV"}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all shrink-0"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Create Channel Footer */}
          {tracks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-400">Total duration:</span>
                <span className="text-sm font-bold text-white font-mono">{formatTime(totalTracksDuration)}</span>
              </div>
              
              <button
                onClick={handleSaveChannel}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Constructing Wheel Playout...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Activate 24h Auto-Channel</span>
                  </>
                )}
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
