import { IPTVChannel } from "../types";
import M3uWorker from "../workers/m3uParser.worker?worker";

export function parseM3UPlaylistAsync(rawContent: string, baseUrl?: string): Promise<IPTVChannel[]> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new M3uWorker();
      
      worker.onmessage = (e: MessageEvent<any>) => {
        resolve(e.data.channels ? e.data.channels : e.data); // Support both direct array and object with .channels
        worker.terminate();
      };
      
      worker.onerror = (e: ErrorEvent) => {
        reject(new Error(e.message || 'Worker error in parsing M3U'));
        worker.terminate();
      };
      
      worker.postMessage({ rawContent, baseUrl });
    } catch (e) {
      reject(e);
    }
  });
}
