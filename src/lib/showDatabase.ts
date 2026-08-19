import { safeLocalStorage } from "../utils/safeStorage";
// Local Relational TV Meta-Database Engine
// Implements SQLite-like queries with prefix routing: w:, wa:, c:, s:, p:, y:
// Fully human-editable, portable, with import/export for JSON + CSV.

export interface Show {
  show_id: string;
  title: string;
  year_start: number;
  year_end?: number;
  genre: string;
  network: string;
  plot: string;
  source: string; // 'omdb' | 'tvdb' | 'user_manual'
  custom_fields?: {
    user_rating?: number;
    personal_notes?: string;
  };
}

export interface Episode {
  episode_id: string;
  show_id: string;
  season: number;
  episode: number;
  title: string;
  air_date?: string;
  plot?: string;
  source: string;
}

export interface CastMember {
  cast_id: string;
  show_id: string;
  actor_name: string;
  character_name: string;
  episodes_appeared: number;
  source: string;
}

export interface UserNote {
  note_id: string;
  show_id: string;
  episode_id?: string;
  note_text: string;
  created: string;
  tagged_shows: string[]; // JSON array of titles/IDs
}

export interface UserReview {
  show_id: string;
  user_rating?: number;
  personal_notes?: string;
  last_updated?: string;
}

// Prefaces/Modes matching the CURSES spec
export enum SearchMode {
  WHO = "w",          // Cast members
  WHEN = "wa",        // Year/dates
  CONNECTIONS = "c",  // Cross-show analysis
  SERIES = "s",       // Show metadata
  PLOT = "p",         // Genre/themes
  YEAR = "y"          // Timeline/decades
}

// Default Seed Data
const DEFAULT_SHOWS: Show[] = [
  {
    show_id: "columbo_1971",
    title: "Columbo",
    year_start: 1971,
    year_end: 1978,
    genre: "Crime Drama, Mystery",
    network: "NBC",
    plot: "Lieutenant Columbo, a disheveled but brilliant homicide detective, uses his deceptively clumsy personality and obsessive eye for detail to corner high-status murderers who think they committed the perfect crime.",
    source: "omdb",
    custom_fields: {
      user_rating: 9.8,
      personal_notes: "Absolutely stellar performance by Peter Falk in monochrome and rich technicolor."
    }
  },
  {
    show_id: "mash_1972",
    title: "MASH",
    year_start: 1972,
    year_end: 1983,
    genre: "War Comedy Drama",
    network: "CBS",
    plot: "The lives and antics of the staff at an Army Mobile Surgical Hospital during the Korean War, balancing surgeon humor with tragic frontline realities.",
    source: "omdb",
    custom_fields: {
      user_rating: 9.2,
      personal_notes: "A timeless masterpiece of television editing and ensemble cast chemistry."
    }
  },
  {
    show_id: "hogans_1965",
    title: "Hogans Heroes",
    year_start: 1965,
    year_end: 1971,
    genre: "War Comedy, Satire",
    network: "CBS",
    plot: "Allied prisoners of war conduct an active espionage and sabotage operation inside a German POW camp right under the nose of their inept camp commandant, Colonel Klink.",
    source: "tvdb",
    custom_fields: {
      user_rating: 8.5,
      personal_notes: "Delightful retro pacing and incredible character alignment."
    }
  },
  {
    show_id: "twilight_1959",
    title: "The Twilight Zone",
    year_start: 1959,
    year_end: 1964,
    genre: "Sci-Fi, Anthology, Horror",
    network: "CBS",
    plot: "Rod Serling introduces weekly speculative stories containing commentary on existential fear, sci-fi parables, and classic twist endings.",
    source: "omdb",
    custom_fields: {
      user_rating: 9.5
    }
  }
];

const DEFAULT_EPISODES: Episode[] = [
  { episode_id: "col_s01e01", show_id: "columbo_1971", season: 1, episode: 1, title: "Murder by the Book", air_date: "1971-09-15", plot: "A mystery writer decides to stage his partner's actual homicide.", source: "omdb" },
  { episode_id: "col_s03e12", show_id: "columbo_1971", season: 3, episode: 12, title: "A Case of Immunity", air_date: "1975-10-12", plot: "An arrogant foreign diplomat murders his security officer.", source: "omdb" },
  { episode_id: "mash_s02e05", show_id: "mash_1972", season: 2, episode: 5, title: "The 5 O'Clock Charlie", air_date: "1973-10-13", plot: "An amateur North Korean pilot attempts to bomb an ammo dump.", source: "omdb" },
  { episode_id: "hog_s01e01", show_id: "hogans_1965", season: 1, episode: 1, title: "The Caper", air_date: "1965-09-17", plot: "Hogan assists an escaping agent using hidden tunnels.", source: "tvdb" }
];

const DEFAULT_CAST: CastMember[] = [
  // Columbo Cast
  { cast_id: "c_col_1", show_id: "columbo_1971", actor_name: "Peter Falk", character_name: "Lt. Columbo", episodes_appeared: 69, source: "omdb" },
  { cast_id: "c_col_2", show_id: "columbo_1971", actor_name: "Mike Lally", character_name: "Burke / Detective Burke", episodes_appeared: 22, source: "user_manual" },
  { cast_id: "c_col_3", show_id: "columbo_1971", actor_name: "John Finnegan", character_name: "Barney / Barney the Diner Owner", episodes_appeared: 12, source: "omdb" },
  { cast_id: "c_col_4", show_id: "columbo_1971", actor_name: "Vito Scotti", character_name: "Thomas / Salvatore", episodes_appeared: 9, source: "omdb" },
  
  // M*A*S*H Cast
  { cast_id: "c_mash_1", show_id: "mash_1972", actor_name: "Alan Alda", character_name: "Captain Hawkeye Pierce", episodes_appeared: 251, source: "omdb" },
  { cast_id: "c_mash_2", show_id: "mash_1972", actor_name: "Loretta Swit", character_name: "Major Margaret Houlihan", episodes_appeared: 251, source: "omdb" },
  { cast_id: "c_mash_3", show_id: "mash_1972", actor_name: "Jamie Farr", character_name: "Corporal Klinger", episodes_appeared: 215, source: "omdb" },
  { cast_id: "c_mash_4", show_id: "mash_1972", actor_name: "William Christopher", character_name: "Father Mulcahy", episodes_appeared: 215, source: "omdb" },
  { cast_id: "c_mash_5", show_id: "mash_1972", actor_name: "Mike Lally", character_name: "Soldier (uncredited background)", episodes_appeared: 8, source: "user_manual" },
  { cast_id: "c_mash_6", show_id: "mash_1972", actor_name: "John Finnegan", character_name: "Frontline Sergeant", episodes_appeared: 3, source: "user_manual" },

  // Hogan's Heroes Cast
  { cast_id: "c_hog_1", show_id: "hogans_1965", actor_name: "Bob Crane", character_name: "Col. Robert E. Hogan", episodes_appeared: 168, source: "tvdb" },
  { cast_id: "c_hog_2", show_id: "hogans_1965", actor_name: "Werner Klemperer", character_name: "Col. Wilhelm Klink", episodes_appeared: 168, source: "tvdb" },
  { cast_id: "c_hog_3", show_id: "hogans_1965", actor_name: "John Banner", character_name: "Sgt. Hans Schultz", episodes_appeared: 168, source: "tvdb" },
  { cast_id: "c_hog_4", show_id: "hogans_1965", actor_name: "Richard Dawson", character_name: "Cpl. Peter Newkirk", episodes_appeared: 168, source: "tvdb" },

  // Twilight Zone Cast
  { cast_id: "c_twil_1", show_id: "twilight_1959", actor_name: "Rod Serling", character_name: "Narrator", episodes_appeared: 156, source: "omdb" }
];

// Helper class for asynchronous IndexedDB transactions
class IndexedDBStore {
  private dbName = "TVMetaDatabase";
  private storeName = "kv_store";

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error("IndexedDB not supported in this client window"));
        return;
      }
      try {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error || new Error("Failed to boot IndexedDB instance"));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => {
          resolve((request.result as T) || null);
          db.close();
        };
        request.onerror = () => {
          reject(request.error);
          db.close();
        };
      });
    } catch (e) {
      console.warn(`IndexedDB READ failed for [${key}], utilizing LocalStorage fallback:`, e);
      return null;
    }
  }

  public async set(key: string, value: any): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        store.put(value, key);
        transaction.oncomplete = () => {
          resolve();
          db.close();
        };
        transaction.onerror = () => {
          reject(transaction.error);
          db.close();
        };
      });
    } catch (e) {
      console.warn(`IndexedDB WRITE failed for [${key}]:`, e);
    }
  }
}

export class TVMetaDatabase {
  private shows: Show[] = [];
  private episodes: Episode[] = [];
  private cast: CastMember[] = [];
  private notes: UserNote[] = [];
  
  // Isolated Decoupled user reviews storage to solve overwrite vulnerability
  private userReviews: Record<string, UserReview> = {};
  
  // Storage Managers
  private idb = new IndexedDBStore();
  private readonly MAX_SHOW_LIMIT = 10000;
  private isIndexedDBActive = false;

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      // 1. Eager Synchronous Load from LocalStorage for immediate UI paint
      const s = safeLocalStorage.getItem("ajn_db_shows");
      const e = safeLocalStorage.getItem("ajn_db_episodes");
      const c = safeLocalStorage.getItem("ajn_db_cast");
      const n = safeLocalStorage.getItem("ajn_db_notes");
      const r = safeLocalStorage.getItem("ajn_db_user_reviews");

      if (r) {
        const _r = JSON.parse(r); if (_r !== null) this.userReviews = _r;
      }

      if (s) {
        this.shows = JSON.parse(s);
      } else {
        // Bootstrap seed data & decouple user ratings/notes instantly
        this.shows = DEFAULT_SHOWS.map(sh => {
          if (sh.custom_fields) {
            this.userReviews[sh.show_id] = {
              show_id: sh.show_id,
              user_rating: sh.custom_fields.user_rating,
              personal_notes: sh.custom_fields.personal_notes,
              last_updated: new Date().toISOString()
            };
          }
          return { ...sh, custom_fields: undefined };
        });
        this.saveShows();
        this.saveReviews();
      }

      if (e) this.episodes = JSON.parse(e);
      else {
        this.episodes = [...DEFAULT_EPISODES];
        this.saveEpisodes();
      }

      if (c) this.cast = JSON.parse(c);
      else {
        this.cast = [...DEFAULT_CAST];
        this.saveCast();
      }

      if (n) this.notes = JSON.parse(n);
    } catch (err) {
      console.error("Local database init error, resetting to standard structures:", err);
      this.shows = DEFAULT_SHOWS.map(sh => ({ ...sh, custom_fields: undefined }));
      this.episodes = [...DEFAULT_EPISODES];
      this.cast = [...DEFAULT_CAST];
      this.notes = [];
      this.userReviews = {};
    }

    // 2. Async Sync-up from Infinite IndexedDB Store to support limits > 5MB seamlessly
    this.syncIndexedDB();
  }

  private async syncIndexedDB() {
    try {
      const shows = await this.idb.get<Show[]>("shows");
      const eps = await this.idb.get<Episode[]>("episodes");
      const cast = await this.idb.get<CastMember[]>("cast");
      const notes = await this.idb.get<UserNote[]>("notes");
      const reviews = await this.idb.get<Record<string, UserReview>>("user_reviews");

      let updated = false;

      if (shows && Array.isArray(shows) && shows.length > 0) {
        this.shows = shows.slice(0, this.MAX_SHOW_LIMIT);
        updated = true;
      }
      if (eps && Array.isArray(eps)) {
        this.episodes = eps;
        updated = true;
      }
      if (cast && Array.isArray(cast)) {
        this.cast = cast;
        updated = true;
      }
      if (notes && Array.isArray(notes)) {
        this.notes = notes;
        updated = true;
      }
      if (reviews && typeof reviews === 'object' && reviews !== null) {
        this.userReviews = reviews;
        updated = true;
      }

      this.isIndexedDBActive = true;
      if (updated) {
        console.log(`[Database] Fully loaded relational dataset safely from IndexedDB transaction loop.`);
      }
    } catch (err) {
      console.warn("IndexedDB background synchronization disabled (utilizing LocalStorage only):", err);
      this.isIndexedDBActive = false;
    }
  }

  // Double storage persistence flusher
  private saveShows() { 
    try {
      safeLocalStorage.setItem("ajn_db_shows", JSON.stringify(this.shows)); 
    } catch (err) {
      console.warn("LocalStorage quota hit! Discarding local writes, relying on secure IndexedDB persistence.", err);
    }
    this.idb.set("shows", this.shows); 
  }

  private saveEpisodes() { 
    try {
      safeLocalStorage.setItem("ajn_db_episodes", JSON.stringify(this.episodes)); 
    } catch (err) {
      console.warn("LocalStorage quota hit on episodes!", err);
    }
    this.idb.set("episodes", this.episodes); 
  }

  private saveCast() { 
    try {
      safeLocalStorage.setItem("ajn_db_cast", JSON.stringify(this.cast)); 
    } catch (err) {
      console.warn("LocalStorage quota hit on cast indices!", err);
    }
    this.idb.set("cast", this.cast); 
  }

  private saveNotes() { 
    try {
      safeLocalStorage.setItem("ajn_db_notes", JSON.stringify(this.notes)); 
    } catch (err) {
      console.warn("LocalStorage quota hit on notes!", err);
    }
    this.idb.set("notes", this.notes); 
  }

  private saveReviews() {
    try {
      safeLocalStorage.setItem("ajn_db_user_reviews", JSON.stringify(this.userReviews));
    } catch (err) {
      console.warn("LocalStorage quota hit on reviews!", err);
    }
    this.idb.set("user_reviews", this.userReviews);
  }

  // Dynamic review merger to preserve API transparency with UI layers!
  public getShows(): Show[] { 
    return this.shows.map(show => {
      const rev = this.userReviews[show.show_id];
      if (rev) {
        return {
          ...show,
          custom_fields: {
            user_rating: rev.user_rating,
            personal_notes: rev.personal_notes
          }
        };
      }
      return show;
    });
  }

  public getEpisodes() { return this.episodes; }
  public getCast() { return this.cast; }
  public getNotes() { return this.notes; }
  public getReviews() { return this.userReviews; }

  // Guards adding new shows by capping dataset size to exactly 10,000 shows
  private allowAddingShow(incomingCount: number = 1): { allowed: boolean; takeCount: number; message?: string } {
    const currentCount = this.shows.length;
    if (currentCount >= this.MAX_SHOW_LIMIT) {
      return { 
        allowed: false, 
        takeCount: 0, 
        message: `REJECTED: Show metadata registry cap has hit the safety threshold of ${this.MAX_SHOW_LIMIT} shows. Delete channels to append others.` 
      };
    }
    const remaining = this.MAX_SHOW_LIMIT - currentCount;
    if (incomingCount > remaining) {
      return {
        allowed: true,
        takeCount: remaining,
        message: `QUOTA TRIGGER: Bulk ingest capped. Truncated incoming index to fit limit constraints (retained ${remaining}, discarded ${incomingCount - remaining} records).`
      };
    }
    return { allowed: true, takeCount: incomingCount };
  }

  // Runtime Schema Validators (Protects against DB corruption during JSON/CSV loads)
  public static validateShow(s: any): string[] {
    const errs: string[] = [];
    if (!s || typeof s !== 'object') return ["Item must be an analytical payload object"];
    if (typeof s.show_id !== 'string' || !s.show_id.trim()) errs.push("missing field 'show_id' (string)");
    if (typeof s.title !== 'string' || !s.title.trim()) errs.push("missing field 'title' (string)");
    if (typeof s.year_start !== 'number' || isNaN(s.year_start)) errs.push("missing or invalid field 'year_start' (number)");
    if (s.year_end !== undefined && s.year_end !== null && typeof s.year_end !== 'number') errs.push("'year_end' must compile to number");
    if (s.genre !== undefined && typeof s.genre !== 'string') errs.push("'genre' must compile to string");
    if (s.network !== undefined && typeof s.network !== 'string') errs.push("'network' must compile to string");
    if (s.plot !== undefined && typeof s.plot !== 'string') errs.push("'plot' must compile to string");
    return errs;
  }

  public static validateEpisode(e: any): string[] {
    const errs: string[] = [];
    if (!e || typeof e !== 'object') return ["Invalid relational node"];
    if (typeof e.episode_id !== 'string' || !e.episode_id.trim()) errs.push("missing 'episode_id'");
    if (typeof e.show_id !== 'string' || !e.show_id.trim()) errs.push("missing relate-key 'show_id'");
    if (typeof e.season !== 'number' || isNaN(e.season)) errs.push("invalid season count");
    if (typeof e.episode !== 'number' || isNaN(e.episode)) errs.push("invalid episode count");
    if (typeof e.title !== 'string' || !e.title.trim()) errs.push("invalid ep 'title'");
    return errs;
  }

  public static validateCast(c: any): string[] {
    const errs: string[] = [];
    if (!c || typeof c !== 'object') return ["Invalid cast entity"];
    if (typeof c.cast_id !== 'string' || !c.cast_id.trim()) errs.push("missing 'cast_id'");
    if (typeof c.show_id !== 'string' || !c.show_id.trim()) errs.push("missing show ID foreign pointer");
    if (typeof c.actor_name !== 'string' || !c.actor_name.trim()) errs.push("missing 'actor_name'");
    if (typeof c.character_name !== 'string' || !c.character_name.trim()) errs.push("missing 'character_name'");
    return errs;
  }

  public static validateNote(n: any): string[] {
    const errs: string[] = [];
    if (!n || typeof n !== 'object') return ["Invalid text note matrix"];
    if (typeof n.note_id !== 'string' || !n.note_id.trim()) errs.push("missing note index key");
    if (typeof n.show_id !== 'string' || !n.show_id.trim()) errs.push("missing tag reference key");
    if (typeof n.note_text !== 'string') errs.push("missing review text block");
    return errs;
  }

  // Safe manual review overrides setter (guarantees separate persistence keys)
  public saveUserOverride(showId: string, rating?: number, notes?: string) {
    const existing = this.userReviews[showId] || { show_id: showId };
    
    this.userReviews[showId] = {
      show_id: showId,
      user_rating: rating !== undefined ? rating : existing.user_rating,
      personal_notes: notes !== undefined ? notes : existing.personal_notes,
      last_updated: new Date().toISOString()
    };
    
    this.saveReviews();
  }

  // Mutates database with strict boundary limits and field extraction
  /**
   * Compare an incoming show item against the existing database record.
   * Returns:
   *  - 'insert' if the ID or lowercase title does not exist in the shows index.
   *  - 'update' if any metadata fields (title, year_start, year_end, genre, network, plot, source) have changed.
   *  - 'identical' if all properties match exactly.
   */
  public compareShow(show: Show): 'insert' | 'update' | 'identical' {
    const idx = this.shows.findIndex(s => s.show_id === show.show_id || s.title.toLowerCase() === show.title.toLowerCase());
    if (idx < 0) {
      return 'insert';
    }
    const existing = this.shows[idx];
    if (
      existing.title !== show.title ||
      existing.year_start !== show.year_start ||
      existing.year_end !== show.year_end ||
      existing.genre !== show.genre ||
      existing.network !== show.network ||
      existing.plot !== show.plot ||
      existing.source !== show.source
    ) {
      return 'update';
    }
    return 'identical';
  }

  public addShow(show: Show): boolean {
    const idx = this.shows.findIndex(s => s.show_id === show.show_id || s.title.toLowerCase() === show.title.toLowerCase());
    
    // Decouple rating and notes if supplied inside properties
    if (show.custom_fields) {
      const showId = idx >= 0 ? this.shows[idx].show_id : show.show_id;
      this.saveUserOverride(showId, show.custom_fields.user_rating, show.custom_fields.personal_notes);
    }

    const action = this.compareShow(show);
    if (action === 'identical') {
      // SKIPPED: Record is identical to database cache. Redundant disk/storage I/O bypassed.
      return true;
    }

    if (idx >= 0) {
      // Overwrite raw metadata only (leaving reviews separate)
      this.shows[idx] = { 
        ...this.shows[idx], 
        ...show, 
        custom_fields: undefined 
      };
      this.saveShows();
      return true;
    }

    // New show limit validation
    const check = this.allowAddingShow(1);
    if (!check.allowed) {
      console.warn(check.message);
      return false;
    }

    this.shows.push({
      ...show,
      custom_fields: undefined
    });
    this.saveShows();
    return true;
  }

  public addCastMember(c: CastMember) {
    const idx = this.cast.findIndex(cm => cm.cast_id === c.cast_id);
    if (idx >= 0) {
      this.cast[idx] = c;
    } else {
      this.cast.push(c);
    }
    this.saveCast();
  }

  public addNote(showId: string, text: string, tags: string[] = []) {
    const n: UserNote = {
      note_id: "note_" + Date.now().toString(36),
      show_id: showId,
      note_text: text,
      created: new Date().toISOString(),
      tagged_shows: tags
    };
    this.notes.unshift(n);
    this.saveNotes();
    return n;
  }

  // Storage utilization inspector terminal UI
  private showStorageStats(): string[] {
    const sStr = JSON.stringify(this.shows);
    const eStr = JSON.stringify(this.episodes);
    const cStr = JSON.stringify(this.cast);
    const nStr = JSON.stringify(this.notes);
    const rStr = JSON.stringify(this.userReviews);

    const totalBytes = sStr.length + eStr.length + cStr.length + nStr.length + rStr.length;
    const mbUsed = (totalBytes / (1024 * 1024)).toFixed(3);
    const pcQuota = ((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(1);

    const dbChannel = this.isIndexedDBActive 
      ? "IndexedDB Secure Core + LocalStorage Mirror (ONLINE)" 
      : "LocalStorage Only (WARN: Sandbox restricted limits)";

    return [
      "=== TV COCKPIT RELATIONAL SCHEMA INSPECTOR ===",
      `ENGINE STATS:  ${dbChannel}`,
      `SHOW REGISTRY: ${this.shows.length} / ${this.MAX_SHOW_LIMIT} mapped shows [${((this.shows.length / this.MAX_SHOW_LIMIT) * 100).toFixed(1)}% count]`,
      `EPISODES REF:  ${this.episodes.length} files parsed`,
      `CAST CONNECTS: ${this.cast.length} active mappings`,
      `NOTES WRITTEN: ${this.notes.length} memo entries`,
      `USER REVIEWS:  ${Object.keys(this.userReviews).length} reviews isolated`,
      "----------------------------------------------",
      `Active Footprint Space: ${mbUsed} Mebibytes`,
      `Standard Local Quota:   ${pcQuota}% utilized (5MB limit)`,
      this.shows.length >= this.MAX_SHOW_LIMIT 
        ? "⚠️ CRITICAL LIMIT: Max 10,000 threshold reached! Clean indexes to bypass lock."
        : "✅ ENGINE STATUS: Relational arrays stable. Free memory space ready."
    ];
  }

  // Parses queries and returns console line arrays
  public executeTUIQuery(query: string): string[] {
    // Escape single quotes to prevent injection crashes inside parsing outputs
    const safeQuery = query.replace(/'/g, "''");
    const trimmed = safeQuery.trim();

    if (!trimmed) {
      return [
        "AJN SQLITE SIMULATOR - PROMPT IDLE",
        "Type command syntax with prefixes below:",
        "-----------------------------------------",
        "  w:<title>          - List actor cast members",
        "  wa:<year>          - Find shows around specific year",
        "  c:<show1, show2>   - Find shared cast connections",
        "  s:<title>          - Display metadata series summary",
        "  y:<decade>         - Filter shows by decade (e.g. y:1970)",
        "  p:<genre_or_plot>  - Fuzzy match genres and plots",
        "  rate:<title>=<10>  - Rate a cataloged show (0.0 - 10.0)",
        "  note:<title>=<txt> - Add custom remark securely",
        "  stats              - Display database size, health & limits",
        "  help               - Print interactive schema guidance"
      ];
    }

    const lowerQuery = trimmed.toLowerCase();
    if (lowerQuery === "help") {
      return [
        "=== SCHEMA DICTIONARY (SQLite v3.45 Engine Mock) ===",
        "TABLE: shows (show_id TEXT PK, title TEXT, year_start INT, genre TEXT, plot TEXT)",
        "TABLE: episodes (episode_id TEXT PK, show_id TEXT FK, season INT, title TEXT)",
        "TABLE: cast (cast_id TEXT PK, show_id TEXT FK, actor_name TEXT, character_name TEXT)",
        "TABLE: user_reviews (show_id TEXT PK, user_rating REAL, personal_notes TEXT)",
        "-----------------------------------------",
        "Custom Ratings & Critique commands:",
        "  rate: columbo = 10         --> Marks Columbo with score: 10",
        "  note: mash = Best finale  --> Writes isolated custom remark",
        "  stats                      --> Analyzes local database quota metrics"
      ];
    }

    if (lowerQuery === "stats" || lowerQuery === "quota" || lowerQuery === "info") {
      return this.showStorageStats();
    }

    const colonIdx = trimmed.indexOf(":");
    let mode: SearchMode | null = null;
    let term = trimmed;
    let prefix = "";

    if (colonIdx > 0) {
      prefix = trimmed.substring(0, colonIdx).toLowerCase();
      term = trimmed.substring(colonIdx + 1).trim();

      const modeMap: Record<string, SearchMode> = {
        w: SearchMode.WHO,
        wa: SearchMode.WHEN,
        c: SearchMode.CONNECTIONS,
        s: SearchMode.SERIES,
        p: SearchMode.PLOT,
        y: SearchMode.YEAR
      };
      mode = modeMap[prefix] || null;
    }

    // INTERCEPT: Custom Interactive Setters for Ratings
    if (prefix === "rate") {
      const eqIdx = term.indexOf("=");
      if (eqIdx < 0) {
        return ["ERROR: Rate syntax requires assignment operator.", "Syntax: rate: <title> = <rating_number>"];
      }
      const showTitleQuery = term.substring(0, eqIdx).trim();
      const scoreStr = term.substring(eqIdx + 1).trim();
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0 || score > 10) {
        return ["ERROR: Rating value must represent a floating number between 0.0 and 10.0"];
      }

      const show = this.getShows().find(s => s.title.toLowerCase().includes(showTitleQuery.toLowerCase()));
      if (!show) return [`ERROR: Show matching key "${showTitleQuery}" was not resolved in index.`];

      this.saveUserOverride(show.show_id, score, undefined);
      return [
        `=== UPDATE user_reviews SET user_rating = ${score} WHERE show_id = '${show.show_id}' ===`,
        `Successfully updated user score for "${show.title}": ⭐ ${score} / 10`,
        `User ratings decoupled safely in distinct secure local storage array.`
      ];
    }

    // INTERCEPT: Custom Interactive Setters for Notes
    if (prefix === "note") {
      const eqIdx = term.indexOf("=");
      if (eqIdx < 0) {
        return ["ERROR: Note syntax requires assignment operator.", "Syntax: note: <title> = <personal_remark_text>"];
      }
      const showTitleQuery = term.substring(0, eqIdx).trim();
      const memoText = term.substring(eqIdx + 1).trim();

      const show = this.getShows().find(s => s.title.toLowerCase().includes(showTitleQuery.toLowerCase()));
      if (!show) return [`ERROR: Show matching key "${showTitleQuery}" was not found.`];

      this.saveUserOverride(show.show_id, undefined, memoText);
      return [
        `=== UPDATE user_reviews SET personal_notes = '${memoText}' WHERE show_id = '${show.show_id}' ===`,
        `Successfully set user remark on "${show.title}":`,
        `  "${memoText}"`,
        `Changes saved separately with zero data merge conflict threats.`
      ];
    }

    if (!mode) {
      // Default fuzzy guess if no colon present
      return this.executeFuzzyGlobalSearch(trimmed);
    }

    switch (mode) {
      case SearchMode.WHO:
        return this.searchCast(term);
      case SearchMode.CONNECTIONS:
        return this.findConnections(term);
      case SearchMode.SERIES:
        return this.getSeriesInfo(term);
      case SearchMode.WHEN:
        return this.getTemporalInfo(term);
      case SearchMode.YEAR:
        return this.filterByYear(term);
      case SearchMode.PLOT:
        return this.searchPlot(term);
      default:
        return [`Syntax command prefix unmapped. Type help to review guidelines.`];
    }
  }

  private executeFuzzyGlobalSearch(term: string): string[] {
    const termLower = term.toLowerCase();
    
    // Leverage our getShows override so reviews merge cleanly
    const showMatch = this.getShows().filter(s => s.title.toLowerCase().includes(termLower));
    const actorMatch = this.cast.filter(c => c.actor_name.toLowerCase().includes(termLower));

    const lines: string[] = [`Fuzzy search matches for token: "${term}"`];
    lines.push("-----------------------------------------");

    if (showMatch.length > 0) {
      lines.push(`Matched ${showMatch.length} Show(s):`);
      showMatch.forEach(s => {
        let stars = s.custom_fields?.user_rating ? ` ⭐ ${s.custom_fields.user_rating}/10` : "";
        lines.push(`  * ${s.title} (${s.year_start}-${s.year_end || "Present"})${stars} - S:${s.source}`);
      });
    }

    if (actorMatch.length > 0) {
      lines.push(`${showMatch.length > 0 ? "" : "\n"}Matched ${actorMatch.length} Cast Member(s):`);
      actorMatch.forEach(a => {
        const associatedShow = this.getShows().find(s => s.show_id === a.show_id)?.title || a.show_id;
        lines.push(`  * ${a.actor_name} as "${a.character_name}" in ${associatedShow} (${a.episodes_appeared} eps)`);
      });
    }

    if (showMatch.length === 0 && actorMatch.length === 0) {
      lines.push(`No occurrences located inside database indexes.`);
      lines.push(`Try command (e.g. s:columbo) or load M3U file.`);
    }

    return lines;
  }

  private searchCast(showQuery: string): string[] {
    const showQueryLower = showQuery.toLowerCase();
    const matchedShow = this.getShows().find(s => s.title.toLowerCase().includes(showQueryLower));

    if (!matchedShow) {
      return [`No series records found matching: "${showQuery}" in database.`];
    }

    const showCast = this.cast.filter(c => c.show_id === matchedShow.show_id);
    const lines = [
      `=== SELECT * FROM cast WHERE show_id = '${matchedShow.show_id}' ===`,
      `Show Title: ${matchedShow.title} (${matchedShow.year_start})`,
      `Cast count: ${showCast.length} cataloged actors`,
      "-----------------------------------------"
    ];

    if (showCast.length === 0) {
      lines.push("No actors rostered for this show. Map rows manually or ingest bulk lists.");
    } else {
      showCast
        .sort((a, b) => b.episodes_appeared - a.episodes_appeared)
        .forEach(c => {
          lines.push(`  • ${c.actor_name.padEnd(20)} as ${c.character_name.padEnd(28)} [${c.episodes_appeared} eps] - S:${c.source}`);
        });
    }

    return lines;
  }

  private findConnections(showsList: string): string[] {
    const terms = showsList.split(",").map(t => t.trim().toLowerCase()).filter(t => t);
    if (terms.length < 2) {
      return ["ERROR: Connections directive requires 2+ comma-separated series titles.", "Usage: c: columbo, mash"];
    }

    const matchedShows = terms.map(term => {
      return this.getShows().find(s => s.title.toLowerCase().includes(term));
    }).filter((s): s is Show => !!s);

    if (matchedShows.length < 2) {
      return [
        `ERROR: Could not fetch all series coordinates. Required 2+ matches.`,
        `Resolved queries: ${matchedShows.map(s => s.title).join(", ") || "None"}`,
        `Standard presets: columbo, mash, hogans, twilight`
      ];
    }

    const lines = [
      `=== INNER JOIN INTERSECTION QUERY ACROSS TABLES ===`,
      `Analyzing shared cast nodes:`,
      ...matchedShows.map(s => `  - ${s.title} (${s.show_id})`),
      "-----------------------------------------"
    ];

    // Map actors per show
    const actorSets = matchedShows.map(show => {
      return new Set(this.cast.filter(c => c.show_id === show.show_id).map(c => c.actor_name));
    });

    // Intersection reducer
    const commonActors = actorSets.reduce((acc, currentSet) => {
      return new Set([...acc].filter(x => currentSet.has(x)));
    });

    if (commonActors.size === 0) {
      lines.push("No overlapping cast members cataloged between these shows.");
    } else {
      lines.push(`Located ${commonActors.size} overlap mapping connection(s):`);
      Array.from(commonActors).forEach(actor => {
        lines.push(`  👑 OVERLAP ACTOR: ${actor}`);
        matchedShows.forEach(s => {
          const charPlayed = this.cast.find(c => c.show_id === s.show_id && c.actor_name === actor)?.character_name || "Unknown Role";
          const count = this.cast.find(c => c.show_id === s.show_id && c.actor_name === actor)?.episodes_appeared || 0;
          lines.push(`      ↪ Role: "${charPlayed}" in ${s.title} (${count} episodes)`);
        });
      });
    }

    return lines;
  }

  private getSeriesInfo(query: string): string[] {
    const queryLower = query.toLowerCase();
    const matched = this.getShows().filter(s => s.title.toLowerCase().includes(queryLower));

    if (matched.length === 0) {
      return [`Query matching "s:${query}" returned empty rows.`];
    }

    const lines = [`=== SELECT * FROM shows WHERE title LIKE '%${query}%' ===`];

    matched.forEach(s => {
      lines.push(`\nTitle:      ${s.title}`);
      lines.push(`Show ID:    ${s.show_id}`);
      lines.push(`Release:    ${s.year_start} - ${s.year_end || "Ongoing"}`);
      lines.push(`Genre:      ${s.genre}`);
      lines.push(`Broadcast:  ${s.network}`);
      lines.push(`API Source: ${s.source.toUpperCase()}`);
      lines.push(`Plot Pitch: ${s.plot}`);
      if (s.custom_fields?.user_rating) {
        lines.push(`User Score: ⭐ ${s.custom_fields.user_rating} / 10`);
      }
      if (s.custom_fields?.personal_notes) {
        lines.push(`My Remarks: "${s.custom_fields.personal_notes}"`);
      }
      lines.push("-----------------------------------------");
    });

    return lines;
  }

  private getTemporalInfo(yearQuery: string): string[] {
    const num = parseInt(yearQuery.replace(/\D/g, ""), 10);
    if (isNaN(num)) {
      return [`ERROR: "wa:${yearQuery}" requires a valid 4-digit calendar integer.`];
    }

    const results = this.getShows().filter(s => s.year_start === num || (s.year_start <= num && s.year_end && s.year_end >= num));

    const lines = [
      `=== SELECT * FROM shows WHERE year_start <= ${num} AND year_end >= ${num} ===`,
      `Temporal Year focus: ${num}`,
      "-----------------------------------------"
    ];

    if (results.length === 0) {
      lines.push(`Zero records played/active during calendar year: ${num}.`);
    } else {
      results.forEach(s => {
        lines.push(`  * ${s.title} -- (A: ${s.year_start}-${s.year_end || "present"}) [Genre: ${s.genre}]`);
      });
    }

    return lines;
  }

  private filterByYear(decadeStr: string): string[] {
    const num = parseInt(decadeStr.replace(/\D/g, ""), 10);
    if (isNaN(num)) {
      return [`ERROR: "y:${decadeStr}" requires a 4-digit decade year format (e.g. y:1970).`];
    }

    const decadeStart = Math.floor(num / 10) * 10;
    const decadeEnd = decadeStart + 9;

    const results = this.getShows().filter(s => s.year_start >= decadeStart && s.year_start <= decadeEnd);

    const lines = [
      `=== SELECT * FROM shows WHERE year_start BETWEEN ${decadeStart} AND ${decadeEnd} ===`,
      `Decade Filter Block: ${decadeStart}s Classic Era`,
      "-----------------------------------------"
    ];

    if (results.length === 0) {
      lines.push(`No shows cached from the ${decadeStart}s era yet.`);
    } else {
      results.forEach(s => {
        lines.push(`  🎬 ${s.title.padEnd(20)} [${s.year_start}] -- Broadcast on ${s.network} (${s.genre})`);
      });
    }

    return lines;
  }

  private searchPlot(keywords: string): string[] {
    const keys = keywords.toLowerCase();
    const results = this.getShows().filter(s => s.plot.toLowerCase().includes(keys) || s.genre.toLowerCase().includes(keys));

    const lines = [
      `=== SELECT * FROM shows WHERE plot LIKE '%${keywords}%' OR genre LIKE '%${keywords}%' ===`,
      `FTS Matches located: ${results.length}`,
      "-----------------------------------------"
    ];

    if (results.length === 0) {
      lines.push(`Zero series matched query terms on plot/word matches.`);
    } else {
      results.forEach(s => {
        lines.push(`  📺 ${s.title} (${s.year_start})`);
        lines.push(`     Plot match: "${s.plot.slice(0, 80)}..."`);
        lines.push("");
      });
    }

    return lines;
  }

  // Parses entries from M3U playlist and automatically populates corresponding shows
  public ingestM3U(rawText: string): number {
    const lines = rawText.split("\n");
    let addedCount = 0;

    const pattern = /^([^S]+?)\s+(?:S(\d+)E(\d+))?(?:\s*-\s*(.+))?$/i;

    for (const line of lines) {
      if (line.startsWith("#EXTINF")) {
        const parts = line.split(",", 2);
        if (parts.length > 1) {
          const titleText = parts[1].trim();
          const match = titleText.match(pattern);
          if (match) {
            const showTitle = match[1].trim();
            const showId = showTitle.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + (new Date().getFullYear());

            const exists = this.shows.some(s => s.title.toLowerCase() === showTitle.toLowerCase());
            if (!exists) {
              // Enforce 10,000 threshold dynamically during ingest loops
              const checkCap = this.allowAddingShow(1);
              if (!checkCap.allowed) {
                console.warn(checkCap.message);
                break;
              }

              const guessedGenre = showTitle.includes("Case") || showTitle.includes("Columbo") ? "Mystery, Drama" : "Classic Television";
              const newShow: Show = {
                show_id: showId,
                title: showTitle,
                year_start: 1960 + Math.floor(Math.random() * 50),
                genre: guessedGenre,
                network: "M3U Ingest",
                plot: `Segment playlist stream item labeled "${titleText}" ingested from virtual M3U live feed.`,
                source: "m3u_importer"
              };
              this.shows.push(newShow);
              addedCount++;
            }
          }
        }
      }
    }

    if (addedCount > 0) {
      this.saveShows();
    }
    return addedCount;
  }

  // Export JSON string for backup/edit (fully exports clean metadata + detached reviews)
  public exportJSONString(): string {
    const data = {
      shows: this.shows,
      episodes: this.episodes,
      cast: this.cast,
      notes: this.notes,
      user_reviews: this.userReviews
    };
    return JSON.stringify(data, null, 2);
  }

  // Import JSON configuration with explicit validation + 10k safety and preserving local reviews
  public importJSONString(raw: string): string {
    try {
      let parsed = JSON.parse(raw);
      // Unpack ExportBundle format if wrapped inside metadata/data fields
      if (parsed && parsed.data && typeof parsed.data === 'object' && (parsed.data.shows || parsed.data.episodes || parsed.data.cast)) {
        parsed = parsed.data;
      }
      let validateErrorCount = 0;
      let showsAdded = 0;
      let episodesAdded = 0;
      let castAdded = 0;
      let notesAdded = 0;
      let reviewsParsed = 0;
      let conflictResolvedCount = 0;

      const validatedShows: Show[] = [];
      const validatedEpisodes: Episode[] = [];
      const validatedCast: CastMember[] = [];
      const validatedNotes: UserNote[] = [];
      const importedReviews: Record<string, UserReview> = {};

      // 1. Process and Validate Displays with 10k hard lock
      if (parsed.shows && Array.isArray(parsed.shows)) {
        for (const showItem of parsed.shows) {
          const errs = TVMetaDatabase.validateShow(showItem);
          if (errs.length > 0) {
            validateErrorCount++;
            continue;
          }
          validatedShows.push({ ...showItem, custom_fields: undefined });
        }
      }

      // 2. Filter via maximum threshold limit guard
      const currentQuotaAvailable = this.allowAddingShow(validatedShows.length);
      let targetShowsToImport = validatedShows;
      let limitWarnMessage = "";

      if (!currentQuotaAvailable.allowed) {
        return `Import Rejected: Exceeds 10,000 maximum show size block. Currently contains ${this.shows.length} shows.`;
      }
      if (currentQuotaAvailable.message) {
        limitWarnMessage = " " + currentQuotaAvailable.message;
        targetShowsToImport = validatedShows.slice(0, currentQuotaAvailable.takeCount);
      }

      // 3. Process Episodes, Cast and Notes
      if (parsed.episodes && Array.isArray(parsed.episodes)) {
        for (const ep of parsed.episodes) {
          if (TVMetaDatabase.validateEpisode(ep).length === 0) {
            validatedEpisodes.push(ep);
          } else {
            validateErrorCount++;
          }
        }
      }

      if (parsed.cast && Array.isArray(parsed.cast)) {
        for (const c of parsed.cast) {
          if (TVMetaDatabase.validateCast(c).length === 0) {
            validatedCast.push(c);
          } else {
            validateErrorCount++;
          }
        }
      }

      if (parsed.notes && Array.isArray(parsed.notes)) {
        for (const n of parsed.notes) {
          if (TVMetaDatabase.validateNote(n).length === 0) {
            validatedNotes.push(n);
          } else {
            validateErrorCount++;
          }
        }
      }

      // 4. Parse detached reviews and execute explicit Conflict Resolution
      if (parsed.user_reviews && typeof parsed.user_reviews === 'object') {
        const revMap = parsed.user_reviews as Record<string, UserReview>;
        for (const key of Object.keys(revMap)) {
          const rev = revMap[key];
          if (rev && typeof rev.show_id === 'string') {
            importedReviews[rev.show_id] = rev;
            reviewsParsed++;
          }
        }
      }

      // Also parse legacy custom_fields inside shows if reviews were embedded there
      if (parsed.shows && Array.isArray(parsed.shows)) {
        parsed.shows.forEach((sh: any) => {
          if (sh && sh.show_id && sh.custom_fields) {
            const hasExistingImported = !!importedReviews[sh.show_id];
            if (!hasExistingImported) {
              importedReviews[sh.show_id] = {
                show_id: sh.show_id,
                user_rating: sh.custom_fields.user_rating,
                personal_notes: sh.custom_fields.personal_notes,
                last_updated: new Date().toISOString()
              };
              reviewsParsed++;
            }
          }
        });
      }

      // Explicit Conflict Resolution: local reviews ALWAYS override/protect imported changes
      for (const show_id of Object.keys(importedReviews)) {
        const localReview = this.userReviews[show_id];
        if (localReview && (localReview.user_rating !== undefined || localReview.personal_notes !== undefined)) {
          // Conflict detected! Preserve local fields.
          conflictResolvedCount++;
        } else {
          // No local conflicts, safely adopt imported reviews
          this.userReviews[show_id] = importedReviews[show_id];
        }
      }

      // 5. Atomic local write out to persistent layers
      if (targetShowsToImport.length > 0) {
        // Merge shows list
        targetShowsToImport.forEach(show => {
          const uIdx = this.shows.findIndex(s => s.show_id === show.show_id);
          if (uIdx >= 0) {
            this.shows[uIdx] = show;
          } else {
            this.shows.push(show);
          }
          showsAdded++;
        });
        this.saveShows();
      }

      if (validatedEpisodes.length > 0) {
        validatedEpisodes.forEach(ep => {
          const eIdx = this.episodes.findIndex(e => e.episode_id === ep.episode_id);
          if (eIdx >= 0) this.episodes[eIdx] = ep;
          else this.episodes.push(ep);
          episodesAdded++;
        });
        this.saveEpisodes();
      }

      if (validatedCast.length > 0) {
        validatedCast.forEach(c => {
          const cIdx = this.cast.findIndex(cm => cm.cast_id === c.cast_id);
          if (cIdx >= 0) this.cast[cIdx] = c;
          else this.cast.push(c);
          castAdded++;
        });
        this.saveCast();
      }

      if (validatedNotes.length > 0) {
        validatedNotes.forEach(n => {
          const nIdx = this.notes.findIndex(note => note.note_id === n.note_id);
          if (nIdx >= 0) this.notes[nIdx] = n;
          else this.notes.push(n);
          notesAdded++;
        });
        this.saveNotes();
      }

      this.saveReviews();

      let summary = `Import succeeded! Integrated: ${showsAdded} shows, ${episodesAdded} episodes, ${castAdded} cast-relations, ${notesAdded} memos.`;
      if (conflictResolvedCount > 0) {
        summary += ` Protected/Preserved ${conflictResolvedCount} local notes/ratings from corruption overwrites.`;
      }
      if (validateErrorCount > 0) {
        summary += ` Skipped ${validateErrorCount} corrupted data items.`;
      }
      if (limitWarnMessage) {
        summary += `${limitWarnMessage}`;
      }
      return summary;
    } catch (err: any) {
      return `Import rejection: JSON compilation error: ${err.message}`;
    }
  }

  // CSV Export (Fully preserves schema connections)
  public exportCSVString(): string {
    let csv = "show_id,title,actor_name,character_name,episodes_appeared,source\n";
    this.cast.forEach(c => {
      const showTitle = this.shows.find(s => s.show_id === c.show_id)?.title || "Unknown";
      const sanitizedTitle = showTitle.replace(/"/g, '""');
      const sanitizedActor = c.actor_name.replace(/"/g, '""');
      const sanitizedChar = c.character_name.replace(/"/g, '""');
      csv += `${c.show_id},"${sanitizedTitle}","${sanitizedActor}","${sanitizedChar}",${c.episodes_appeared},${c.source}\n`;
    });
    return csv;
  }

  // CSV Import with dynamic verification, quota guard & merge overrides protection
  public importCSVString(csvText: string): string {
    try {
      const lines = csvText.split("\n");
      if (lines.length < 2) return "Empty CSV rows payload.";
      
      let showsAdded = 0;
      let castAdded = 0;
      let skipLimitCount = 0;
      let validateErrorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Match CSV elements securely
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
        if (matches.length >= 4) {
          const show_id = matches[0].replace(/"/g, "").trim();
          const title = matches[1].replace(/"/g, "").trim();
          const actor_name = matches[2].replace(/"/g, "").trim();
          const character_name = matches[3].replace(/"/g, "").trim();
          const episodes_appeared = matches[4] ? parseInt(matches[4].replace(/"/g, "").trim(), 10) || 1 : 1;
          const source = matches[5] ? matches[5].replace(/"/g, "").trim() : "user_manual";

          // Validate string values before relational insertions
          if (!show_id || !title || !actor_name || !character_name) {
            validateErrorCount++;
            continue;
          }

          // Ensure show metadata entry
          const showExists = this.shows.some(s => s.show_id === show_id);
          if (!showExists) {
            // Guard limit boundaries
            const check = this.allowAddingShow(1);
            if (!check.allowed) {
              skipLimitCount++;
              continue;
            }

            this.shows.push({
              show_id: show_id,
              title: title,
              year_start: 1970,
              genre: "Classic Drama",
              network: "CSV Manual Ingest",
              plot: "Imported via manual CSV row alignment",
              source: "user_manual"
            });
            showsAdded++;
          }

          // Write cast member
          this.addCastMember({
            cast_id: `${show_id}_${actor_name.replace(/\s+/g, "")}`,
            show_id,
            actor_name,
            character_name,
            episodes_appeared,
            source
          });
          castAdded++;
        } else {
          validateErrorCount++;
        }
      }

      this.saveShows();
      this.saveCast();

      let summary = `CSV Ingest completed! Imported ${showsAdded} new shows and ${castAdded} cast entries.`;
      if (skipLimitCount > 0) {
        summary += ` Blocked ${skipLimitCount} shows due to maximum limit constraint of ${this.MAX_SHOW_LIMIT} shows.`;
      }
      if (validateErrorCount > 0) {
        summary += ` Skipped ${validateErrorCount} corrupt parse rows.`;
      }
      return summary;
    } catch (e: any) {
      return `CSV critical compilation error: ${e.message}`;
    }
  }
}

// ============================================================================
// SELF-CONTAINED EXPORT BUNDLE ARCHITECTURE & STANDALONE HTML PLAYER GENERATOR
// ============================================================================

export interface ExportBundle {
  metadata: {
    exportId: string;
    exportDate: string;
    exportedShowIds: string[];
    bundleTitle: string;
    creator: string;
    apiVersion: string;
  };
  data: {
    shows: Show[];
    episodes: Episode[];
    cast: CastMember[];
    notes: UserNote[];
    user_reviews: Record<string, UserReview>;
  };
}

export class BundleExporter {
  public static createBundle(
    db: TVMetaDatabase,
    showIds: string[],
    bundleTitle: string,
    creator: string = "Cinephile Core"
  ): ExportBundle {
    const allShows = db.getShows().filter(s => showIds.includes(s.show_id));
    const allEpisodes = db.getEpisodes().filter(e => showIds.includes(e.show_id));
    const allCast = db.getCast().filter(c => showIds.includes(c.show_id));
    const allNotes = db.getNotes().filter(n => showIds.includes(n.show_id));
    
    const dbReviews = db.getReviews();
    const reviews: Record<string, UserReview> = {};
    for (const show_id of showIds) {
      const rev = dbReviews[show_id];
      if (rev) {
        reviews[show_id] = rev;
      }
    }
    
    return {
      metadata: {
        exportId: `bundle_${Math.random().toString(36).substring(2, 11)}`,
        exportDate: new Date().toISOString(),
        exportedShowIds: showIds,
        bundleTitle: bundleTitle || "Cinephile Custom Collection",
        creator,
        apiVersion: "1.0.0"
      },
      data: {
        shows: allShows,
        episodes: allEpisodes,
        cast: allCast,
        notes: allNotes,
        user_reviews: reviews
      }
    };
  }
}

export class StandalonePlayerGenerator {
  public generateStandaloneHTML(bundle: ExportBundle): string {
    const bundleJSON = JSON.stringify(bundle, null, 2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bundle.metadata.bundleTitle} - Cinephile Standalone Player</title>
  <style>
    :root {
      --bg: #030508;
      --card-bg: #0a0e14;
      --accent: #00ff66;
      --accent-hover: #ccff00;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: rgba(0, 255, 102, 0.2);
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: #06090f;
      border-bottom: 1px solid var(--border);
      padding: 15px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 100;
    }
    .header-left h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: var(--accent);
      letter-spacing: 0.05em;
    }
    .header-left p {
      margin: 3px 0 0;
      font-size: 11px;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      gap: 12px;
    }
    button {
      background: rgba(0, 255, 102, 0.05);
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    button:hover {
      background: var(--accent);
      color: #030508;
      box-shadow: 0 0 10px rgba(0, 255, 102, 0.3);
    }
    .main-container {
      display: flex;
      flex: 1;
      height: calc(100vh - 75px);
      overflow: hidden;
    }
    .sidebar {
      width: 320px;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      background: #06090f;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .sidebar-header {
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .show-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    .show-item {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .show-item:hover {
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.05);
    }
    .show-item.active {
      background: rgba(0, 255, 102, 0.05);
      border-color: var(--border);
    }
    .show-item-title {
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .show-item-meta {
      font-size: 10.5px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
    .content-area {
      flex: 1;
      padding: 25px 30px;
      overflow-y: auto;
      background: #04060b;
      height: 100%;
    }
    .detail-panel {
      max-width: 900px;
      margin: 0 auto;
    }
    .detail-title {
      font-size: 26px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .detail-meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin: 20px 0;
      padding: 15px;
      background: #080c12;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 12.5px;
      font-weight: 600;
    }
    .plot-text {
      font-size: 14px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .episode-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .episode-card {
      background: #070b11;
      border: 1px solid rgba(255, 255, 255, 0.03);
      padding: 15px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }
    .episode-card:hover {
      border-color: rgba(255, 255, 255, 0.08);
      background: #090e16;
    }
    .player-container {
      margin-bottom: 25px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #000;
      display: none;
    }
    .video-wrapper {
      position: relative;
      padding-top: 56.25%;
    }
    video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .cast-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
    }
    .cast-card {
      background: #070b11;
      border: 1px solid rgba(255, 255, 255, 0.02);
      padding: 12px;
      border-radius: 8px;
    }
    .cast-actor {
      font-weight: bold;
      font-size: 13px;
    }
    .cast-char {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .review-form {
      background: rgba(0, 255, 102, 0.02);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      margin-top: 35px;
    }
    .review-form-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .form-group-row {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }
    .form-control {
      background: #05070a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 10px;
      color: #fff;
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
    }
    .form-control:focus {
      outline: none;
      border-color: var(--accent);
    }
    .instructions-modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal-content {
      background: #0a0e14;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 0 30px rgba(0, 255, 102, 0.15);
    }
    .modal-content h3 {
      margin-top: 0;
      color: var(--accent);
    }
    .modal-content p {
      font-size: 13.5px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    p strong {
      color: var(--accent-hover);
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
</head>
<body>

  <header>
    <div class="header-left">
      <h1>${bundle.metadata.bundleTitle}</h1>
      <p>Export bundle package • Curated: ${new Date(bundle.metadata.exportDate).toLocaleDateString()} • Generated by ${bundle.metadata.creator}</p>
    </div>
    <div class="header-actions">
      <button onclick="UI.openModal()">ℹ️ Re-import Instructions</button>
      <button onclick="UI.downloadBundle()">📥 Download Updated Bundle</button>
    </div>
  </header>

  <div class="main-container">
    <div class="sidebar">
      <div class="sidebar-header">Shows in Bundle (${bundle.data.shows.length})</div>
      <div class="show-list" id="showList"></div>
    </div>
    <div class="content-area" id="contentArea">
      <p style="color:var(--text-muted); text-align:center; margin-top:100px;">Select a show from the bundle queue list sidebar to begin curation &amp; playback.</p>
    </div>
  </div>

  <div class="instructions-modal" id="instructionsModal" onclick="UI.closeModal()">
    <div class="modal-content" onclick="event.stopPropagation()">
      <h3>🔄 Snapshot Re-import Mechanics</h3>
      <p>This bundle functions as an offline snapshot backup package. Any adjustments you save locally in this browser can be exported and fully re-imported to the main Cinephile Intelligence Suite app:</p>
      <p>1. Type local review notes or ratings in the tasting panel below of any show.</p>
      <p>2. Click <strong>Commit Review Changes</strong> internally.</p>
      <p>3. Tap <strong>Download Updated Bundle</strong> at the top header bar to download your updated backup snapshot JSON.</p>
      <p>4. Back in the primary app, enter the DB or import section, and drag-and-drop or upload this snapshot. Your evaluations, details, and reviews will merge natively!</p>
      <button onclick="UI.closeModal()" style="margin-top:15px; width:100%;">Got it!</button>
    </div>
  </div>

  <script id="bundle-data" type="application/json">${bundleJSON}</script>

  <script>
    const UI = {
      bundle: null,
      activeShowId: null,
      hls: null,

      init: function() {
        const dataEl = document.getElementById('bundle-data');
        if (!dataEl) return;
        try {
          const rawBundle = JSON.parse(dataEl.textContent);
          const localOverrides = safeLocalStorage.getItem('standalone_review_overrides_' + rawBundle.metadata.exportId);
          if (localOverrides) {
            const overrides = JSON.parse(localOverrides);
            for (const key in overrides) {
              rawBundle.data.user_reviews[key] = overrides[key];
            }
          }
          this.bundle = rawBundle;
        } catch (e) {
          console.error("Failed to parse bundle database data", e);
          return;
        }
        this.renderShowList();
        if (this.bundle.data.shows && this.bundle.data.shows.length > 0) {
          this.selectShow(this.bundle.data.shows[0].show_id);
        }
      },

      renderShowList: function() {
        const listEl = document.getElementById('showList');
        listEl.innerHTML = '';
        this.bundle.data.shows.forEach(show => {
          const episodes = this.bundle.data.episodes.filter(e => e.show_id === show.show_id);
          const item = document.createElement('div');
          item.className = 'show-item' + (this.activeShowId === show.show_id ? ' active' : '');
          item.onclick = () => this.selectShow(show.show_id);
          item.innerHTML = \`
            <div class="show-item-title">\${show.title}</div>
            <div class="show-item-meta">
              <span>\${show.network}</span>
              <span>\${episodes.length} AP / EP</span>
            </div>
          \`;
          listEl.appendChild(item);
        });
      },

      selectShow: function(showId) {
        this.activeShowId = showId;
        const items = document.querySelectorAll('.show-item');
        this.bundle.data.shows.forEach((sh, idx) => {
          if (sh.show_id === showId) {
            items[idx]?.classList.add('active');
          } else {
            items[idx]?.classList.remove('active');
          }
        });

        const show = this.bundle.data.shows.find(s => s.show_id === showId);
        const eps = this.bundle.data.episodes.filter(e => e.show_id === showId).sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
        const cast = this.bundle.data.cast.filter(c => c.show_id === showId);
        const review = this.bundle.data.user_reviews[showId] || {};

        const contentEl = document.getElementById('contentArea');
        const ratingString = review.user_rating ? \`⭐ \${review.user_rating} / 10\` : 'Not Rated';

        contentEl.innerHTML = \`
          <div class="detail-panel">
            <div class="detail-title">\${show.title}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:15px; font-weight:bold; text-transform:uppercase;">Source: \${show.source}</div>
            
            <div class="detail-meta">
              <div class="meta-item">
                <div class="meta-label">Years</div>
                <div class="meta-value">\${show.year_start}\${show.year_end ? ' - ' + show.year_end : ' - Present'}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Network</div>
                <div class="meta-value">\${show.network}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Genre</div>
                <div class="meta-value">\${show.genre}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">User Review</div>
                <div class="meta-value" style="color:var(--accent)">\${ratingString}</div>
              </div>
            </div>

            <p class="plot-text">\${show.plot}</p>

            <!-- Video Player Slot -->
            <div class="player-container" id="playerContainer">
              <div style="padding: 10px 15px; background: #06090f; border-bottom: 1px solid var(--border); font-size: 11px; font-weight: bold; color: var(--accent); display: flex; justify-content: space-between; align-items: center;">
                <span id="playerTitle">PREPARING VIDEO STREAM...</span>
                <button onclick="UI.closePlayer()" style="padding: 3px 8px; font-size: 9px; background: transparent; border-color: rgba(255,255,255,0.2); color: #fff;">✕ Close Player</button>
              </div>
              <div class="video-wrapper" id="ajn-modal-player-frame">
                <video id="videoPlayer" controls autoplay></video>
              </div>
            </div>

            <div class="section-title">Archived Episodes (\${eps.length})</div>
            <div class="episode-list">
              \${eps.length === 0 ? '<p style="color:var(--text-muted); font-size:13px;">No episodes currently archived in this curation record.</p>' : eps.map(ep => {
                const epUrl = "https://archive.org/download/01-tv-fighting-crime/01%20TV%20FIGHTING%20CRIME.mp4";
                return \`
                  <div class="episode-card">
                    <div>
                      <div style="font-weight: 700; font-size: 13.5px;">S\${ep.season} E\${ep.episode}: \${ep.title}</div>
                      \${ep.plot ? \`<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px; max-width: 550px;">\${ep.plot}</div>\` : ''}
                    </div>
                    <button onclick="UI.playEpisode('\${ep.title.replace(/'/g, "\\\\'")}', '\${epUrl}')">▶ Play Stream</button>
                  </div>
                \`;
              }).join('')}
            </div>

            \${cast.length > 0 ? \`
              <div class="section-title">Cast Members</div>
              <div class="cast-grid">
                \${cast.map(c => \`
                  <div class="cast-card">
                    <div class="cast-actor">\${c.actor_name}</div>
                    <div class="cast-char">\${c.character_name}</div>
                  </div>
                \`).join('')}
              </div>
            \` : ''}

            <div class="review-form">
              <div class="review-form-title">Tasting Card &amp; Relational Review Annotation</div>
              <div class="form-group-row">
                <div class="meta-item" style="width: 150px;">
                  <label class="meta-label">Rating (0-10)</label>
                  <input type="number" id="ratingInput" class="form-control" min="0" max="10" step="0.1" value="\${review.user_rating || ''}" placeholder="e.g. 9.5">
                </div>
                <div class="meta-item" style="flex: 1;">
                  <label class="meta-label">Personal Critical Commentary</label>
                  <input type="text" id="notesInput" class="form-control" value="\${review.personal_notes || ''}" placeholder="Type personal critique descriptors...">
                </div>
              </div>
              <button onclick="UI.saveReview('\${showId}')">💾 Commit Review Changes</button>
            </div>
          </div>
        \`;
      },

      playEpisode: function(title, urlString) {
        const container = document.getElementById('playerContainer');
        const player = document.getElementById('videoPlayer');
        const titleEl = document.getElementById('playerTitle');
        
        container.style.display = 'block';
        titleEl.textContent = "NOW PLAYING: " + title;
        
        if (this.hls) {
          this.hls.destroy();
          this.hls = null;
        }

        if (urlString.includes('.m3u8') && Hls.isSupported()) {
          const hlsObj = new Hls();
          hlsObj.loadSource(urlString);
          hlsObj.attachMedia(player);
          this.hls = hlsObj;
        } else {
          player.src = urlString;
        }
        player.play();
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },

      closePlayer: function() {
        const player = document.getElementById('videoPlayer');
        const container = document.getElementById('playerContainer');
        if (player) {
           player.pause();
           player.src = '';
        }
        if (this.hls) {
           this.hls.destroy();
           this.hls = null;
        }
         if (container) {
           container.style.display = 'none';
        }
      },

      saveReview: function(showId) {
        const rating = parseFloat(document.getElementById('ratingInput').value);
        const notes = document.getElementById('notesInput').value;

        if (!this.bundle.data.user_reviews) {
           this.bundle.data.user_reviews = {};
        }

        const updatedReview = {
          show_id: showId,
          user_rating: isNaN(rating) ? undefined : rating,
          personal_notes: notes || undefined,
          last_updated: new Date().toISOString()
        };

        this.bundle.data.user_reviews[showId] = updatedReview;

        const localOverridesKey = 'standalone_review_overrides_' + this.bundle.metadata.exportId;
        let localOverrides = {};
        try {
          const existing = safeLocalStorage.getItem(localOverridesKey);
          if (existing) localOverrides = JSON.parse(existing);
        } catch(e) {}
        localOverrides[showId] = updatedReview;
        safeLocalStorage.setItem(localOverridesKey, JSON.stringify(localOverrides));

        this.selectShow(showId);
        alert('Review committed securely to offline sandbox buffer! Click "Download Updated Bundle" to save this out as a reimportable snapshot.');
      },

      downloadBundle: function() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.bundle, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", this.bundle.metadata.bundleTitle.toLowerCase().replace(/\\s+/g, "_") + "_export_snapshot.json");
        dlAnchorElem.click();
      },

      openModal: function() {
        document.getElementById('instructionsModal').style.display = 'flex';
      },

      closeModal: function() {
        document.getElementById('instructionsModal').style.display = 'none';
      }
    };

    window.onload = () => UI.init();
  </script>
</body>
</html>
`;
  }
}

