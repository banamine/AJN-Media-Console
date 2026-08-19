# Primary live stream (m3u format)
PRIMARY_M3U_URL = "https://rumble.com/live-hls-dvr/79lfxq/playlist.m3u8?key=L6FtVNYIF41ScYJzCwjzz1laa_X3BRxjfEw3RXxVd2LzHzZNtwCPoA&level=1"

# Backup m3u stream (secondary live source)
BACKUP_M3U_URL = "https://rumble.com/live-hls/6uORWUUNxbA/playlist.m3u8?key=YdO2Hg1HIEDfhkC3FydJbouDHBVptZGpjpcznpWJ2X0D5AEOunj5JA"

# Primary embed (for recorded/post-live content)
PRIMARY_EMBED_URL = "https://www.alexjoneslive.com/show/"

# Backup embed (fallback if primary embed fails)
BACKUP_EMBED_URL = "https://rumble.com/embed/v78ghk0/?pub=4pef68"

# Video end time (format: HH:MM:SS) — used to detect if stream is recorded
VIDEO_END_TIME = "20:06:40"

# Timeout thresholds (in seconds)
M3U_TIMEOUT = 10
EMBED_TIMEOUT = 15
