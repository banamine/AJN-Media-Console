import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'tuner.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// 2.2 Internal app DB schema
export function initPodcastDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tuner_stations (
      podcast_id INTEGER PRIMARY KEY,
      channel_number REAL NOT NULL,
      sort_title TEXT NOT NULL,
      title TEXT NOT NULL,
      rss_url TEXT NOT NULL,
      site_link TEXT,
      description TEXT,
      language TEXT,
      genre TEXT,
      country TEXT,
      episode_count INTEGER,
      latest_pubdate INTEGER,
      latest_audio_url TEXT,
      latest_duration_sec INTEGER,
      latest_published_local TEXT,
      latest_duration_formatted TEXT,
      short_summary TEXT,
      image_url TEXT,
      medium TEXT
    );

    CREATE TABLE IF NOT EXISTS tuner_recent_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      podcast_id INTEGER NOT NULL,
      podcast_title TEXT NOT NULL,
      published_ts INTEGER NOT NULL,
      published_local TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      duration_sec INTEGER,
      duration_formatted TEXT,
      country TEXT,
      channel_number REAL,
      FOREIGN KEY (podcast_id) REFERENCES tuner_stations(podcast_id)
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id TEXT NOT NULL,
      podcast_id INTEGER NOT NULL,
      created_ts INTEGER NOT NULL,
      PRIMARY KEY (user_id, podcast_id)
    );

    CREATE TABLE IF NOT EXISTS favorite_podcast_cache (
      podcast_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      rss_url TEXT NOT NULL,
      site_link TEXT,
      genre TEXT,
      country TEXT,
      latest_pubdate INTEGER,
      latest_published_local TEXT,
      latest_audio_url TEXT,
      latest_duration_sec INTEGER,
      latest_duration_formatted TEXT,
      short_summary TEXT,
      image_url TEXT,
      medium TEXT
    );
  `);
}

function normalizeTitle(title: string) {
  let t = title.trim();
  t = t.replace(/^(the|a|an)\s+/i, '');
  return t.toLowerCase();
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toLocalString(ts: number | null) {
  if (!ts) return null;
  const dt = new Date(ts * 1000);
  return dt.toISOString().replace('T', ' ').substring(0, 16);
}

// Dummy data for initial ingestion if empty

import Parser from 'rss-parser';
const parser = new Parser({
  requestOptions: {
    rejectUnauthorized: false,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }
});

async function fetchRecommendations(url: string, defaultMedium: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'AJN-Podcast-Tuner/1.0' }});
    const data = await res.json();
    return data.slice(0, 15).map((item: any) => ({ ...item, medium: item.medium || defaultMedium }));
  } catch (err) {
    console.error('Failed to fetch', url, err);
    return [];
  }
}



export async function runPodcastIngestion() {
  console.log("[Podcast Tuner] Running daily ingestion...");
  
  const recs = await fetchRecommendations('https://public.podcastindex.org/recommendations.json', 'audio');
  const videoRecs = await fetchRecommendations('https://public.podcastindex.org/recommendations_video.json', 'video');
  const musicRecs = await fetchRecommendations('https://public.podcastindex.org/recommendations_music.json', 'music');
  
  const allFeeds = [...recs, ...videoRecs, ...musicRecs];
  
  const pods: any[] = [];
  
  for (const feed of allFeeds) {
    try {
            let parsed;
      try {
        if (feed.url.includes('beetoons.tv') || feed.url.includes('pc20.xml')) {
           // Skip known blocked feeds to prevent error spam
           continue;
        }
        parsed = await parser.parseURL(feed.url);
      } catch (err: any) {
        if (err.message.includes('socket disconnected') || err.message.includes('403')) {
           continue; // suppress noisy cloudflare errors
        }
        console.warn('[Podcast Tuner] Skipping feed', feed.url, 'due to:', err.message);
        continue;
      }

      const latest = parsed.items?.[0];
      if (!latest) continue;
      
      const pubDate = latest.pubDate ? new Date(latest.pubDate).getTime() / 1000 : Math.floor(Date.now() / 1000);
      const enclosure: any = latest.enclosure || {};
      
      pods.push({
        podcast_id: feed.feedId,
        title: feed.title || parsed.title,
        rss_url: feed.url,
        site_link: parsed.link || feed.url,
        description: parsed.description || "",
        language: parsed.language || "en",
        genre: "Mixed",
        country: "Global",
        episode_count: parsed.items?.length || 0,
        latest_pubdate: pubDate,
        latest_audio_url: enclosure.url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        latest_duration_sec: enclosure.length ? parseInt(enclosure.length) / 1000 : 3600,
        sort_title: normalizeTitle(feed.title || parsed.title || ""),
        latest_published_local: toLocalString(pubDate),
        latest_duration_formatted: formatDuration(enclosure.length ? parseInt(enclosure.length) / 1000 : 3600),
        short_summary: (latest.contentSnippet || latest.content || "").substring(0, 100) + '...',
        image_url: feed.image || parsed.image?.url || "",
        medium: feed.medium || "audio"
      });
    } catch (err: any) {
      
    }
  }

  pods.sort((a, b) => a.sort_title.localeCompare(b.sort_title));

  const startChannel = 100.0;
  const step = 0.1;
  pods.forEach((p, idx) => {
    p.channel_number = Number((startChannel + idx * step).toFixed(2));
  });

  const insertStation = db.prepare(`
    INSERT INTO tuner_stations (
      podcast_id, channel_number, sort_title, title, rss_url, site_link,
      description, language, genre, country, episode_count, latest_pubdate,
      latest_audio_url, latest_duration_sec, latest_published_local,
      latest_duration_formatted, short_summary, image_url, medium
    ) VALUES (
      @podcast_id, @channel_number, @sort_title, @title, @rss_url, @site_link,
      @description, @language, @genre, @country, @episode_count, @latest_pubdate,
      @latest_audio_url, @latest_duration_sec, @latest_published_local,
      @latest_duration_formatted, @short_summary, @image_url, @medium
    )
  `);

  db.transaction(() => {
    db.exec('DELETE FROM tuner_recent_episodes; DELETE FROM tuner_stations;');
    for (const p of pods) {
      insertStation.run(p);
    }
  })();

  // Build Recent 200
  const sortedByDate = [...pods].sort((a, b) => (b.latest_pubdate || 0) - (a.latest_pubdate || 0)).slice(0, 200);

  const insertRecent = db.prepare(`
    INSERT INTO tuner_recent_episodes (
      podcast_id, podcast_title, published_ts, published_local, audio_url,
      duration_sec, duration_formatted, country, channel_number
    ) VALUES (
      @podcast_id, @podcast_title, @published_ts, @published_local, @audio_url,
      @duration_sec, @duration_formatted, @country, @channel_number
    )
  `);

  db.transaction(() => {
    db.exec('DELETE FROM tuner_recent_episodes');
    for (const p of sortedByDate) {
      if (!p.latest_audio_url) continue;
      insertRecent.run({
        podcast_id: p.podcast_id,
        podcast_title: p.title,
        published_ts: p.latest_pubdate,
        published_local: p.latest_published_local,
        audio_url: p.latest_audio_url,
        duration_sec: p.latest_duration_sec,
        duration_formatted: p.latest_duration_formatted,
        country: p.country,
        channel_number: p.channel_number
      });
    }
  })();

  console.log("[Podcast Tuner] Daily ingestion complete.");
}


export function getStations(genre?: string, country?: string) {
  let query = 'SELECT * FROM tuner_stations WHERE 1=1';
  const params: any[] = [];
  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }
  if (country) {
    if (country.toLowerCase() !== 'global') {
      query += ' AND country = ?';
      params.push(country);
    }
  }
  query += ' ORDER BY channel_number ASC';
  return db.prepare(query).all(...params);
}

export function getRecentEpisodes(limit = 200) {
  return db.prepare('SELECT * FROM tuner_recent_episodes ORDER BY published_ts DESC LIMIT ?').all(limit);
}

export function getFavorites(userId: string) {
  const query = `
    SELECT f.podcast_id, c.*
    FROM user_favorites f
    LEFT JOIN favorite_podcast_cache c ON f.podcast_id = c.podcast_id
    WHERE f.user_id = ?
  `;
  return db.prepare(query).all(userId);
}

export function addFavorite(userId: string, podcastId: number) {
  db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, podcast_id, created_ts) VALUES (?, ?, ?)').run(userId, podcastId, Math.floor(Date.now() / 1000));
  
  // Try to update cache
  const station = db.prepare('SELECT * FROM tuner_stations WHERE podcast_id = ?').get(podcastId) as any;
  if (station) {
    db.prepare(`
      INSERT OR REPLACE INTO favorite_podcast_cache (
        podcast_id, title, rss_url, site_link, genre, country,
        latest_pubdate, latest_published_local, latest_audio_url,
        latest_duration_sec, latest_duration_formatted, short_summary
      ) VALUES (
        @podcast_id, @title, @rss_url, @site_link, @genre, @country,
        @latest_pubdate, @latest_published_local, @latest_audio_url,
        @latest_duration_sec, @latest_duration_formatted, @short_summary
      )
    `).run(station);
  }
}

export function removeFavorite(userId: string, podcastId: number) {
  db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND podcast_id = ?').run(userId, podcastId);
}
