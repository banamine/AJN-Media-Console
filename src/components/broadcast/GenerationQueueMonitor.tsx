import React, { useState, useEffect } from "react";
import { queueManager } from "../../broadcast/QueueManager";
import { registry } from "../../broadcast/RegistryManager";
import { Sparkles, Loader2, AlertCircle, RefreshCw, Layers, CheckCircle2, XCircle, ChevronDown, Play } from "lucide-react";

export function GenerationQueueMonitor() {
  const [snapshot, setSnapshot] = useState(() => queueManager.getSnapshot());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = registry.subscribe("queue_updated", () => {
      setSnapshot(queueManager.getSnapshot());
    });
    const unsubStart = registry.subscribe("queue_processing_started", () => {
      setSnapshot(queueManager.getSnapshot());
    });
    const unsubFail = registry.subscribe("queue_job_failed", () => {
      setSnapshot(queueManager.getSnapshot());
    });
    const unsubComp = registry.subscribe("queue_job_completed", () => {
      setSnapshot(queueManager.getSnapshot());
    });

    // Also poll every 2 seconds as fallback for async thread updates
    const timer = setInterval(() => {
      setSnapshot(queueManager.getSnapshot());
    }, 2000);

    return () => {
      unsub();
      unsubStart();
      unsubFail();
      unsubComp();
      clearInterval(timer);
    };
  }, []);

  const handleAutoGenerateMissing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const count = queueManager.enqueueMissingThumbnails("CINEMATIC");
    setSnapshot(queueManager.getSnapshot());
    if (count > 0) {
      setIsOpen(true);
    }
  };

  const handleRetry = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    queueManager.retryJob(jobId);
    setSnapshot(queueManager.getSnapshot());
  };

  const { activeJob, pendingCount, failedJobs, allJobs } = snapshot;
  const isActivelyGenerating = activeJob !== null || pendingCount > 0;

  return (
    <div className="relative z-50 select-none font-sans">
      {/* Trigger Button in Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
          isActivelyGenerating
            ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 shadow-sm shadow-indigo-900/40 animate-pulse"
            : failedJobs.length > 0
            ? "bg-red-500/15 border-red-500/40 text-rose-300"
            : "bg-slate-800/40 hover:bg-slate-800 border-slate-700/60 text-slate-300"
        }`}
        title="Global GPU Thumbnail Playout Queue Monitor"
      >
        {isActivelyGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        ) : failedJobs.length > 0 ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        )}

        <span className="font-mono text-[11px] tracking-tight">
          {isActivelyGenerating ? (
            <>GPU QUEUE ({pendingCount + (activeJob ? 1 : 0)})</>
          ) : (
            <>GPU SYNC</>
          )}
        </span>

        {failedJobs.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] font-mono font-bold text-white">
            {failedJobs.length}
          </span>
        )}

        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0B0E14] border border-slate-700/80 shadow-2xl overflow-hidden z-50 animate-fadeIn">
          {/* Header Bar */}
          <div className="p-3.5 bg-[#141A29] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white tracking-wide">Playout GPU Queue</span>
            </div>
            <button
              onClick={handleAutoGenerateMissing}
              className="px-2.5 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Auto-scan registry and generate missing thumbnails"
            >
              <Sparkles className="w-3 h-3" />
              <span>AUTO-GEN MISSING</span>
            </button>
          </div>

          {/* Active Job Section */}
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/40">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">Active Generation</div>
            {activeJob ? (
              <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">{activeJob.title}</div>
                    <div className="text-[10px] font-mono text-indigo-300 uppercase">{activeJob.style}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold shrink-0">
                  PROCESSING
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-1">No active GPU render threads</div>
            )}
          </div>

          {/* Pending & Stats Bar */}
          <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Pending Queue: <strong className="text-slate-200">{pendingCount} jobs</strong></span>
            <span>Completed: <strong className="text-emerald-400">{allJobs.filter(j => j.status === "completed").length}</strong></span>
          </div>

          {/* Failure Log List */}
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60">
            {failedJobs.length > 0 ? (
              failedJobs.map((job) => (
                <div key={job.id} className="p-3 bg-red-950/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-rose-200 truncate">{job.title}</div>
                      <div className="text-[10px] text-red-400/80 truncate">{job.error || "Generation failed"}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRetry(job.id, e)}
                    className="px-2.5 py-1 rounded-xl bg-red-500 hover:bg-rose-600 active:scale-95 text-white text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                    title="Retry this job"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>RETRY</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                Zero failed playout generation jobs.
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2.5 bg-[#0A0D14] border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Thread-Safe Serial Executor</span>
            <button
              onClick={() => queueManager.clearCompleted()}
              className="text-slate-400 hover:text-slate-300 underline cursor-pointer"
            >
              Clear History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
