import { useState, useEffect } from "react";

export interface ToastItem {
  id: string;
  type: "success" | "info" | "error" | "batch";
  title: string;
  message: string;
  thumbnailUrl?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;
const listeners = new Set<ToastListener>();
let activeToasts: ToastItem[] = [];

function emit() {
  for (const listener of listeners) {
    listener([...activeToasts]);
  }
}

export const toastService = {
  subscribe(listener: ToastListener) {
    listeners.add(listener);
    listener([...activeToasts]);
    return () => {
      listeners.delete(listener);
    };
  },

  show(toast: Omit<ToastItem, "id">) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { ...toast, id };
    activeToasts = [...activeToasts, newToast];
    emit();

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  },

  dismiss(id: string) {
    activeToasts = activeToasts.filter((t) => t.id !== id);
    emit();
  },

  showImportSuccess(playlistName: string, trackCount: number, thumbnailUrl?: string) {
    this.show({
      type: "success",
      title: "🎵 Playlist Imported!",
      message: `${playlistName} — ${trackCount} tracks added`,
      thumbnailUrl,
      duration: 5000
    });
  },

  showBatchComplete(total: number, failed: number, playlistNames: string[]) {
    const succeeded = total - failed;
    const summary = playlistNames.length > 0 
      ? `Successfully loaded ${succeeded} of ${total} lists: ${playlistNames.slice(0, 3).join(", ")}${playlistNames.length > 3 ? "..." : ""}`
      : `Batch completed: ${succeeded} succeeded, ${failed} failed`;
    
    this.show({
      type: "batch",
      title: "📊 Batch Import Finished!",
      message: summary,
      duration: 6000
    });
  },

  showImportError(errorMessage: string) {
    this.show({
      type: "error",
      title: "❌ Import Failed",
      message: errorMessage,
      duration: 5000
    });
  }
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    return toastService.subscribe(setToasts);
  }, []);
  return {
    toasts,
    dismiss: (id: string) => toastService.dismiss(id)
  };
}
