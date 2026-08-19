import React, { useState, useMemo } from "react";
import { BatchProgress } from "../hooks/useArchivePlaylistImporter";
import { 
  Play, 
  Ban, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Loader2, 
  ListPlus, 
  Clipboard, 
  Eraser,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface BatchImportWidgetProps {
  batchProgress: BatchProgress;
  isLoading: boolean;
  onImportBatch: (urls: string[], preferredFormat?: string) => Promise<void>;
  onCancelBatch: () => void;
  onClose: () => void;
  theme?: "light" | "dark";
}

export const BatchImportWidget: React.FC<BatchImportWidgetProps> = ({
  batchProgress,
  isLoading,
  onImportBatch,
  onCancelBatch,
  onClose,
  theme = "dark"
}) => {
  const [inputText, setInputText] = useState("");
  const [errorInput, setErrorInput] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<"all" | "mp3" | "flac">("all");

  const urlsList = useMemo(() => {
    return inputText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"));
  }, [inputText]);

  const handleStartImport = () => {
    if (urlsList.length === 0) {
      setErrorInput("Please paste or type at least one valid Archive.org M3U stream URL.");
      return;
    }
    setErrorInput(null);
    onImportBatch(urlsList, preferredFormat);
  };

  const handleClear = () => {
    setInputText("");
    setErrorInput(null);
  };

  const handlePasteSample = () => {
    setInputText(
      `https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4\nhttps://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4`
    );
    setErrorInput(null);
  };

  // Compute status colors & symbols for the progress list items
  const renderItemStatus = (status: "pending" | "importing" | "success" | "failed", errMessage?: string) => {
    switch (status) {
      case "success":
        return (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Success</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium" title={errMessage}>
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="truncate max-w-[120px]">{errMessage || "Failed"}</span>
          </div>
        );
      case "importing":
        return (
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
            <span className="animate-pulse">Active...</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <HelpCircle className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Waiting</span>
          </div>
        );
    }
  };

  const filePercentage = batchProgress.total > 0 
    ? Math.round((batchProgress.current / batchProgress.total) * 100) 
    : 0;

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-2xl flex flex-col gap-4">
      {/* Header Panel */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded-xl text-blue-400">
            <ListPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Batch Archive.org Importer</h3>
            <p className="text-[11px] text-slate-400">Synchronize multiple compilations sequentially. Paste one M3U url per line.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800 cursor-pointer transition-all shrink-0"
        >
          Close Panel
        </button>
      </div>

      {batchProgress.status === "idle" ? (
        // Input phase
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (errorInput) setErrorInput(null);
              }}
              placeholder={`Paste Archive.org M3U urls here... (one per line)\nExample:\nhttps://archive.org/download/my_favorite_jazz_m3u/playlist.m3u`}
              className="w-full h-32 md:h-40 bg-slate-900/60 text-slate-100 placeholder-slate-500 text-xs border border-slate-800/80 rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y font-mono"
            />
            {inputText.length === 0 && (
              <span className="absolute right-3.5 bottom-3 text-[10px] text-slate-550 pointer-events-none select-none">
                {urlsList.length} lists detected
              </span>
            )}
          </div>

          {errorInput && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/10 px-3.5 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorInput}</span>
            </div>
          )}

          {/* Preferred Format Selector */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold uppercase text-slate-500">
              Preferred Format (Optional)
            </label>
            <div className="flex gap-2">
              {(["all", "mp3", "flac"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPreferredFormat(fmt)}
                  className={`flex-1 select-none text-[10px] font-mono font-semibold uppercase py-1.5 px-2.5 rounded-xl border transition-all cursor-pointer ${
                    preferredFormat === fmt
                      ? "bg-blue-600/15 border-blue-500 text-blue-400 font-bold shadow-sm"
                      : "bg-slate-900/30 border-slate-800/60 text-slate-400 hover:bg-slate-800/40"
                  }`}
                >
                  {fmt === "all" ? "All Formats" : fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Footer */}
          <div className="flex flex-wrap items-center gap-2.5 justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePasteSample}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono border border-slate-805 text-slate-400 rounded-xl bg-slate-900/30 hover:bg-slate-850/60 hover:text-slate-200 transition-all cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Paste Samples
              </button>
              {inputText && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono border border-slate-805 text-slate-400 rounded-xl bg-slate-900/30 hover:bg-slate-850/60 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear Input
                </button>
              )}
            </div>

            <button
              onClick={handleStartImport}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-900/20 active:scale-[0.98] transition-all cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Import All ({urlsList.length} lists detected)
            </button>
          </div>
        </div>
      ) : (
        // Progress phase
        <div className="flex flex-col gap-4">
          {/* Progress bar info layout */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">
                  {batchProgress.status === "importing" ? "Active Batch Import Processing..." : "Import Completed!"}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">
                {batchProgress.current} / {batchProgress.total} lists ({filePercentage}%)
              </span>
            </div>

            {/* Progress Bar Background */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  batchProgress.status === "error" 
                    ? "bg-red-500" 
                    : batchProgress.status === "done" 
                    ? "bg-emerald-500" 
                    : "bg-blue-500"
                }`}
                style={{ width: `${filePercentage}%` }}
              />
            </div>

            {/* Cancel Button */}
            {batchProgress.status === "importing" && (
              <div className="flex justify-end mt-3">
                <button
                  onClick={onCancelBatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400 text-[10px] font-mono hover:bg-red-500/10 rounded-xl cursor-pointer transition-all"
                >
                  <Ban className="w-3.5 h-3.5" />
                  CANCEL ENTIRE BATCH
                </button>
              </div>
            )}
          </div>

          {/* Sequential items log status */}
          <div className="max-h-48 overflow-y-auto border border-slate-900/80 rounded-xl bg-slate-900/20 divide-y divide-slate-900">
            {batchProgress.results.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 truncate" title={item.url}>
                    {item.url.split("/").pop() || item.url}
                  </div>
                  <div className="text-[10px] text-slate-450 truncate font-mono mt-0.5">
                    {item.url}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {renderItemStatus(item.status, item.errorMessage)}
                </div>
              </div>
            ))}
          </div>

          {/* Back button after completion */}
          {batchProgress.status !== "importing" && (
            <div className="flex justify-end pt-2 border-t border-slate-900/65">
              <button
                onClick={onCancelBatch} // resets the batch hook status back to idle
                className="px-4 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-900 font-semibold border border-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Start New Batch
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
