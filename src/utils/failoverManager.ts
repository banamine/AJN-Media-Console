import { playoutStore } from "./playoutStore";

export interface FailoverContext {
  url: string;
  errorObj?: MediaError | null;
  currentTime?: number;
  availableSources?: string[];
  retryCount?: number;
}

export interface FailoverAction {
  action: "retry" | "next_source" | "abort";
  nextUrl?: string;
  resumeFromSec?: number;
  delayMs?: number;
}

const MAX_AUTO_RETRIES = 3;

export function evaluateFailover(context: FailoverContext): FailoverAction {
  const { url, errorObj, currentTime = 0, availableSources = [], retryCount = 0 } = context;

  // If there's a specific media error and it's network/decode, try to retry on the same source first
  if (errorObj && (errorObj.code === 2 /* NETWORK */ || errorObj.code === 3 /* DECODE */)) {
    if (retryCount < MAX_AUTO_RETRIES) {
      const delayMs = 500 * (retryCount + 1);
      const resumeFrom = Math.max(0, currentTime + 2); // nudge past the bad packet
      return {
        action: "retry",
        delayMs,
        resumeFromSec: resumeFrom,
      };
    }
  }

  // Otherwise, or if retries are exhausted, try to switch to the next priority source
  const currentIdx = availableSources.findIndex(s => s === url || decodeURI(s) === decodeURI(url));
  
  if (currentIdx !== -1 && currentIdx + 1 < availableSources.length) {
    const nextUrl = availableSources[currentIdx + 1];
    
    // Dispatch unified failover event for the UI
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent('FailoverEngaged', {
        detail: { originalUrl: url, activeStreamUrl: nextUrl }
      }));
    }

    return {
      action: "next_source",
      nextUrl,
    };
  }

  // If format error (4) and no next source, we abort and emit the error event
  if (errorObj && errorObj.code === 4 /* MEDIA_ERR_SRC_NOT_SUPPORTED */) {
     if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('ajn-stream-format-error', {
          detail: { url }
        }));
     }
  }

  // If all else fails
  return {
    action: "abort",
  };
}
