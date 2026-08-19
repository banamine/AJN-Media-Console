import React, { useState, useEffect } from "react";
import { MusicTrack } from "../types";
import { Music, X, Image as ImageIcon } from "lucide-react";
import { extractTitleFromFilename } from "../utils/playlistUtils";
import { useEscapeKey } from "../hooks/useEscapeKey";

interface TrackRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (track: Omit<MusicTrack, "id" | "dateAdded" | "isFavorite">) => void;
  theme: "light" | "dark";
  initialData?: Partial<MusicTrack> & { thumbnailUrl?: string };
}

export function TrackRegistrationModal({
  isOpen,
  onClose,
  onSave,
  theme,
  initialData
}: TrackRegistrationModalProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [url, setUrl] = useState("");
  const [album, setAlbum] = useState("");
  const [year, setYear] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");

  useEscapeKey(() => {
    if (isOpen) onClose();
  });

  // Sync with initialData whenever it changes or the modal opens
  useEffect(() => {
    if (isOpen) {
      const urlVal = initialData?.url || "";
      let titleVal = initialData?.title || "";
      let artistVal = initialData?.artist || "";
      let genreVal = initialData?.genre || "";

      // Try auto-population if url exists but artist or title are missing/generic
      if (urlVal && (!artistVal || artistVal === "Unknown Artist" || !titleVal)) {
        try {
          const pathname = decodeURIComponent(new URL(urlVal).pathname);
          const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
          if (filename) {
            const parsed = extractTitleFromFilename(filename);
            if (!titleVal) titleVal = parsed.title;
            if (!artistVal || artistVal === "Unknown Artist") artistVal = parsed.artist;
            if (!genreVal) genreVal = "Alternative";
          }
        } catch (_) {
          const lastSlash = urlVal.lastIndexOf("/");
          const filename = lastSlash !== -1 ? urlVal.substring(lastSlash + 1) : urlVal;
          if (filename) {
            const parsed = extractTitleFromFilename(filename);
            if (!titleVal) titleVal = parsed.title;
            if (!artistVal || artistVal === "Unknown Artist") artistVal = parsed.artist;
            if (!genreVal) genreVal = "Alternative";
          }
        }
      }

      setTitle(titleVal);
      setArtist(artistVal);
      setGenre(genreVal);
      setUrl(urlVal);
      setAlbum(initialData?.album || "");
      setYear(initialData?.year ? String(initialData.year) : "");
      setThumbnailUrl(initialData?.thumbnailUrl || "");
    }
  }, [isOpen, initialData]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    if (newUrl && (!artist || artist === "Unknown Artist" || !title)) {
      try {
        const pathname = decodeURIComponent(new URL(newUrl).pathname);
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        if (filename) {
          const parsed = extractTitleFromFilename(filename);
          if (!title) setTitle(parsed.title);
          if (!artist || artist === "Unknown Artist") setArtist(parsed.artist);
          if (!genre) setGenre("Alternative");
        }
      } catch (_) {
        const lastSlash = newUrl.lastIndexOf("/");
        const filename = lastSlash !== -1 ? newUrl.substring(lastSlash + 1) : newUrl;
        if (filename) {
          const parsed = extractTitleFromFilename(filename);
          if (!title) setTitle(parsed.title);
          if (!artist || artist === "Unknown Artist") setArtist(parsed.artist);
          if (!genre) setGenre("Alternative");
        }
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      return;
    }
    onSave({
      title: title.trim(),
      artist: artist.trim() || "Unknown Artist",
      url: url.trim(),
      genre: genre.trim() || "Alternative",
      album: album.trim() || "Single",
      year: year ? parseInt(year, 10) : new Date().getFullYear(),
      sourceType: "music"
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form 
        onSubmit={handleSubmit}
        className={`w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl scale-100 animate-zoom-in ${
          theme === "light" ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-850 text-white"
        }`}
        id="track-registration-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Music className="w-4 h-4 text-emerald-400" /> {initialData?.id ? "Edit Track Metadata" : "Register Custom Track"}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Thumbnail Preview */}
        {thumbnailUrl && (
          <div className={`p-3 rounded-xl border flex items-center gap-3 ${
            theme === "light" ? "bg-slate-50 border-slate-200" : "bg-slate-900/50 border-slate-800"
          }`}>
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-800/30 bg-slate-900 shrink-0 flex items-center justify-center">
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt="Track Preview" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setThumbnailUrl("")}
                />
              ) : (
                <ImageIcon className="w-5 h-5 text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Source Artwork</p>
              <p className="text-xs font-semibold truncate text-slate-300">{album || "Album Release"}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono text-slate-500 mb-1">TRACK TITLE *</label>
            <input
              type="text"
              required
              placeholder="e.g. Stairway to Heaven"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1">ARTIST NAME</label>
            <input
              type="text"
              placeholder="e.g. Led Zeppelin"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1">GENRE CATEGORY</label>
            <input
              type="text"
              placeholder="e.g. Classic Rock"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono text-slate-500 mb-1">RAW AUDIO FILE URL (.mp3 / .wav / .m4a) *</label>
            <input
              type="url"
              required
              placeholder="https://example.com/audio/track_name.mp3"
              value={url}
              onChange={handleUrlChange}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1">ALBUM COVER RELEASE</label>
            <input
              type="text"
              placeholder="e.g. IV (Untitled)"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1">RELEASE YEAR</label>
            <input
              type="number"
              placeholder="e.g. 1971"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/20">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-800 text-xs rounded-xl hover:bg-slate-900 text-slate-400 cursor-pointer animate-pulse"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-xl text-white shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            {initialData?.id ? "Save Changes" : "Inject Track Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
