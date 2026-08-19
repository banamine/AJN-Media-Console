import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, bigint, index, uniqueIndex, boolean, jsonb } from "drizzle-orm/pg-core";

// ── Canonical Content-Type allowlist ────────────────────────────────────────
export const CONTENT_TYPES = ["news", "movie", "series", "music", "radio", "kids", "short", "documentary", "sports", "promo"] as const;
export type ContentType = typeof CONTENT_TYPES[number];

export const PREEMPT_TYPES = ["persistent", "dispense", "promo", "emergency"] as const;
export type PreemptType = typeof PREEMPT_TYPES[number];

export const DAYPARTS = ["Early Morning", "Morning", "Midday", "Afternoon", "Evening", "Prime Time", "Late Night", "Overnight", "Weekend", "Sunday Cinema"] as const;
export type Daypart = typeof DAYPARTS[number];

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const episodes = pgTable("episodes", {
  id: varchar("id").primaryKey(),
  season: integer("season").notNull(),
  episode: integer("episode").notNull(),
  title: text("title").notNull(),
  duration: integer("duration").notNull().default(0),
  url: text("url").notNull(),
  status: text("status").notNull().default("valid"),
  groupTitle: text("group_title"),
  tvgId: text("tvg_id"),
  tvgName: text("tvg_name"),
  tvgLogo: text("tvg_logo"),
  thumbnailUrl: text("thumbnail_url"),
  sourceHost: text("source_host"),
  subtitleUrl: text("subtitle_url"),
  isWebCompatible: boolean("is_web_compatible").notNull().default(true),
  description: text("description"),
  importedAt: timestamp("imported_at").notNull().default(sql`now()`),
  validatedAt: timestamp("validated_at"),
  resolvedUrl: text("resolved_url"),
  contentType: text("content_type"),
  objectPosition: text("object_position"),
  airDate: text("air_date"),
  isLive: boolean("is_live").notNull().default(false),
  ytVideoId: text("yt_video_id"),
  iframeUrl: text("iframe_url"),
  expiresAt: timestamp("expires_at"),
  sourceType: text("source_type"),
  lastPlayedAt: timestamp("last_played_at"),
  priority: integer("priority").notNull().default(0),
  mustPlayFull: boolean("must_play_full").notNull().default(false),
  thumbnailLocked: boolean("thumbnail_locked").notNull().default(false),
  tags: jsonb("tags").$type<string[]>().default([]),
  preferredDayparts: jsonb("preferred_dayparts").$type<string[]>().default([]),
  cutPoints: jsonb("cut_points").$type<number[]>().default([]),
  resumeOffset: integer("resume_offset").notNull().default(0),
  preempt: boolean("preempt").notNull().default(false),
  preemptType: text("preempt_type"),
  allowedPlayers: jsonb("allowed_players").$type<string[]>(),
}, (table) => ({
  titleIdx:  index("episodes_title_idx").on(table.title),
  groupIdx:  index("episodes_group_idx").on(table.groupTitle),
  statusIdx: index("episodes_status_idx").on(table.status),
  urlUniqueIdx: uniqueIndex("episodes_url_unique_idx").on(table.url),
}));

export type Episode = typeof episodes.$inferSelect;

export const localVaults = pgTable("local_vaults", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  label: text("label").notNull(),
  lastScanned: timestamp("last_scanned"),
  status: text("status").notNull().default("active"),
});

export const archiveHoldingQueue = pgTable("archive_holding_queue", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier").notNull().unique(),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  retryAt: timestamp("retry_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  ready: boolean("ready").notNull().default(false),
  pendingEpisodeJson: text("pending_episode_json"),
});

export const playlistSlots = pgTable("playlist_slots", {
  slotId:        integer("slot_id").primaryKey(),
  savedAt:       timestamp("saved_at").notNull().default(sql`now()`),
  episodesJson:  text("episodes_json").notNull(),
  movieCount:    integer("movie_count").notNull().default(0),
  newsCount:     integer("news_count").notNull().default(0),
  newsSourceList: text("news_source_list"),
  strippedNews:  boolean("stripped_news").notNull().default(false),
});

export const ajEpisodes = pgTable("aj_episodes", {
  id:        serial("id").primaryKey(),
  episodeId: text("episode_id").notNull(),
  filename:  text("filename").notNull(),
  modMs:     bigint("mod_ms", { mode: "number" }).notNull().default(0),
  lastAired: timestamp("last_aired"),
  playCount: integer("play_count").notNull().default(0),
}, (table) => ({
  episodeIdIdx: uniqueIndex("aj_episodes_episode_id_idx").on(table.episodeId),
  filenameIdx:  index("aj_episodes_filename_idx").on(table.filename),
}));

export const NEWS_BREAK_TYPES = ["scheduled_00", "scheduled_30", "scheduled", "manual", "force_inject"] as const;
export type NewsBreakType = typeof NEWS_BREAK_TYPES[number];

export const newsBreakLog = pgTable("news_break_log", {
  id:        serial("id").primaryKey(),
  firedAt:   timestamp("fired_at").notNull().default(sql`now()`),
  breakType: text("break_type").notNull().default("manual"),
  playerId:  text("player_id"),
  feedUrl:   text("feed_url"),
  payload:   jsonb("payload").$type<Record<string, unknown>>(),
}, (table) => ({
  firedAtIdx: index("news_break_log_fired_at_idx").on(table.firedAt),
  typeIdx:    index("news_break_log_type_idx").on(table.breakType),
}));