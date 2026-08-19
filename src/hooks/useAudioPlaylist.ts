import { useState, useEffect } from "react";
import { AudioPlaylist, AudioTrack } from "../types";
import { parsePLS } from "../utils/playlistUtils";
import { getAllDBValues, putsDBValue, deleteDBValue } from "../services/IndexedDB";
import { safeLocalStorage } from "../utils/safeStorage";

export function useAudioPlaylist() {
  const [audioPlaylists, setAudioPlaylists] = useState<AudioPlaylist[]>([]);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(() => {
    return safeLocalStorage.getItem("ajn_current_audio_playlist_id") || null;
  });

  // Load playlists from IndexedDB on mount
  useEffect(() => {
    async function loadFromDB() {
      try {
        const playlists = await getAllDBValues<AudioPlaylist>("audio_playlists");
        setAudioPlaylists(playlists || []);
      } catch (err) {
        console.error("Failed to load audio playlists from IndexedDB:", err);
      }
    }
    loadFromDB();
  }, []);

  const savePlaylist = async (playlist: AudioPlaylist) => {
    try {
      await putsDBValue("audio_playlists", playlist);
      setAudioPlaylists((prev) => {
        const idx = prev.findIndex((p) => p.id === playlist.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = playlist;
          return updated;
        } else {
          return [...prev, playlist];
        }
      });
    } catch (err) {
      console.error("Failed to save audio playlist to IndexedDB:", err);
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      await deleteDBValue("audio_playlists", id);
      setAudioPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (currentPlaylistId === id) {
        setCurrentPlaylistId(null);
        safeLocalStorage.removeItem("ajn_current_audio_playlist_id");
      }
    } catch (err) {
      console.error("Failed to delete audio playlist from IndexedDB:", err);
    }
  };

  const selectPlaylist = (id: string | null) => {
    setCurrentPlaylistId(id);
    if (id) {
      safeLocalStorage.setItem("ajn_current_audio_playlist_id", id);
    } else {
      safeLocalStorage.removeItem("ajn_current_audio_playlist_id");
    }
  };

  const getCurrentPlaylist = (): AudioPlaylist | undefined => {
    if (!currentPlaylistId) return undefined;
    return audioPlaylists.find((p) => p.id === currentPlaylistId);
  };

  const [plsImporting, setPlsImporting] = useState<boolean>(false);
  const [plsImportProgress, setPlsImportProgress] = useState<number>(0);
  const [plsImportStatus, setPlsImportStatus] = useState<string>("");

  const runImportProgress = async (tracksLength: number): Promise<void> => {
    if (tracksLength <= 100) return;
    setPlsImporting(true);
    setPlsImportProgress(0);
    setPlsImportStatus(`Initializing import of ${tracksLength} tracks...`);
    
    const total = tracksLength;
    let importedCount = 0;
    const startTime = Date.now();
    
    return new Promise<void>((resolve) => {
      const yieldImport = () => {
        if (importedCount >= total) {
          setPlsImporting(false);
          setPlsImportProgress(100);
          setPlsImportStatus("");
          resolve();
          return;
        }
        
        importedCount = Math.min(importedCount + Math.ceil(total / 15), total);
        const percent = Math.round((importedCount / total) * 100);
        
        const elapsed = Date.now() - startTime;
        const remaining = percent > 0 ? Math.round(((100 - percent) / percent) * elapsed / 1000) : 0;
        
        setPlsImportProgress(percent);
        setPlsImportStatus(`Parsed & compiled ${importedCount} of ${total} tracks. Est. time: ${remaining}s...`);
        
        setTimeout(yieldImport, 25);
      };
      yieldImport();
    });
  };

  const loadPLS = async (url: string): Promise<AudioPlaylist | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const content = await response.text();
      const tracks = parsePLS(content);
      if (tracks.length === 0) return null;

      await runImportProgress(tracks.length);

      let name = "Loaded PLS Playlist";
      try {
        const urlObj = new URL(url);
        const pathname = decodeURIComponent(urlObj.pathname);
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        if (filename) name = filename;
      } catch (_) {}

      const newPlaylist: AudioPlaylist = {
        id: "pls-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        name,
        tracks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePlaylist(newPlaylist);
      selectPlaylist(newPlaylist.id);
      return newPlaylist;
    } catch (err) {
      console.error("Failed to load PLS playlist from URL:", err);
      return null;
    }
  };

  const loadPLSFile = async (file: File): Promise<AudioPlaylist | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const tracks = parsePLS(content);
          if (tracks.length === 0) {
            resolve(null);
            return;
          }

          await runImportProgress(tracks.length);

          const newPlaylist: AudioPlaylist = {
            id: "pls-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
            name: file.name.replace(/\.[^/.]+$/, ""),
            tracks,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await savePlaylist(newPlaylist);
          selectPlaylist(newPlaylist.id);
          resolve(newPlaylist);
        } catch (err) {
          console.error("Failed to parse local PLS file:", err);
          resolve(null);
        }
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsText(file);
    });
  };

  const loadM3UAsAudio = async (content: string): Promise<AudioPlaylist | null> => {
    try {
      if (!content) return null;
      const lines = content.split(/\r?\n/);
      const AUDIO_EXTENSIONS = [".mp3", ".opus", ".aac", ".flac", ".wav", ".ogg", ".m4a", ".mp4a", ".wma", ".mpg", ".mpeg", ".mpga"];
      
      const tracks: AudioTrack[] = [];
      let currentTrackInfo: Partial<AudioTrack> = {};

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith("#EXTINF:")) {
          const durMatch = line.match(/#EXTINF:(-?\d+)/);
          const duration = durMatch ? parseInt(durMatch[1], 10) : -1;

          const lastCommaIdx = line.lastIndexOf(",");
          const postCommaName = lastCommaIdx !== -1 ? line.substring(lastCommaIdx + 1).trim() : "";
          
          let artist = "";
          let title = postCommaName || "M3U Audio Track";
          
          const dashIdx = postCommaName.indexOf(" - ");
          if (dashIdx !== -1) {
            artist = postCommaName.substring(0, dashIdx).trim();
            title = postCommaName.substring(dashIdx + 3).trim();
          }

          currentTrackInfo = {
            title,
            artist,
            length: duration,
          };
        } else if (!line.startsWith("#")) {
          const url = line;
          const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
          const isAudio = AUDIO_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext)) || url.toLowerCase().includes(".mp3") || url.toLowerCase().includes(".aac") || url.toLowerCase().includes(".opus");

          if (isAudio) {
            let title = currentTrackInfo.title || "";
            if (!title) {
              const lastSlash = url.lastIndexOf("/");
              title = lastSlash !== -1 ? url.substring(lastSlash + 1) : url;
              try { title = decodeURIComponent(title); } catch (_) {}
            }

            tracks.push({
              title,
              artist: currentTrackInfo.artist || "",
              url,
              length: currentTrackInfo.length !== undefined ? currentTrackInfo.length : -1,
              sourceType: "m3u",
            });
          }
          currentTrackInfo = {};
        }
      }

      if (tracks.length === 0) return null;

      const newPlaylist: AudioPlaylist = {
        id: "m3u-audio-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        name: "Imported M3U Audio",
        tracks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePlaylist(newPlaylist);
      selectPlaylist(newPlaylist.id);
      return newPlaylist;
    } catch (err) {
      console.warn("Failed to parse M3U as audio:", err);
      return null;
    }
  };

  const [enriching, setEnriching] = useState<boolean>(false);
  const [enrichProgress, setEnrichProgress] = useState<number>(0);

  const enrichPlaylistMetadata = async (playlistId: string) => {
    const playlist = audioPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    // Find first archive.org track to extract identifier
    const archiveTrack = playlist.tracks.find(t => t.url && t.url.includes("archive.org/"));
    if (!archiveTrack) return;

    const match = archiveTrack.url.match(/archive\.org\/(?:download|details)\/([^/?#]+)/);
    const identifier = match ? decodeURIComponent(match[1]) : null;
    if (!identifier) return;

    setEnriching(true);
    setEnrichProgress(10);

    try {
      const response = await fetch(`https://archive.org/metadata/${identifier}`);
      if (!response.ok) throw new Error("Metadata API error");
      const data = await response.json();
      
      const meta = data.metadata || {};
      const creator = meta.creator || meta.artist || "Unknown Artist";
      const genre = meta.genre || "Archive Broadcast";
      const album = meta.title || playlist.name;
      const year = meta.year || (meta.date ? meta.date.substring(0, 4) : undefined);
      
      // Find audio files to map track-specific titles and artists
      const files = data.files || [];
      const audioFiles = files.filter((f: any) => f.name && (f.name.toLowerCase().endsWith(".mp3") || f.name.toLowerCase().endsWith(".flac") || f.name.toLowerCase().endsWith(".ogg") || f.name.toLowerCase().endsWith(".m4a")));
      
      setEnrichProgress(50);

      const enrichedTracks = playlist.tracks.map((track) => {
        if (!track.url.includes("archive.org/")) return track;
        
        // Find matching file by name
        const filename = decodeURIComponent(track.url.substring(track.url.lastIndexOf("/") + 1));
        const fileMeta = audioFiles.find((f: any) => decodeURIComponent(f.name) === filename || f.name === filename);
        
        return {
          ...track,
          artist: fileMeta?.creator || fileMeta?.artist || creator || track.artist || "Unknown Artist",
          title: fileMeta?.title || track.title,
          genre: fileMeta?.genre || genre,
          album: fileMeta?.album || album,
          year: fileMeta?.year || year ? parseInt(fileMeta?.year || year, 10) : undefined,
        };
      });

      const updatedPlaylist: AudioPlaylist = {
        ...playlist,
        tracks: enrichedTracks,
        updatedAt: new Date().toISOString()
      };

      setEnrichProgress(90);
      await savePlaylist(updatedPlaylist);
      setEnrichProgress(100);
    } catch (err) {
      console.error("Failed to enrich playlist metadata:", err);
    } finally {
      setTimeout(() => {
        setEnriching(false);
        setEnrichProgress(0);
      }, 500);
    }
  };

  const updatePlaylistFolder = async (id: string, folderName: string) => {
    const playlist = audioPlaylists.find(p => p.id === id);
    if (playlist) {
      const updated = {
        ...playlist,
        folder: folderName || undefined,
        updatedAt: new Date().toISOString()
      };
      await savePlaylist(updated);
    }
  };

  return {
    audioPlaylists,
    currentPlaylistId,
    selectPlaylist,
    savePlaylist,
    deletePlaylist,
    getCurrentPlaylist,
    loadPLS,
    loadPLSFile,
    loadM3UAsAudio,
    enriching,
    enrichProgress,
    enrichPlaylistMetadata,
    plsImporting,
    plsImportProgress,
    plsImportStatus,
    updatePlaylistFolder,
  };
}
