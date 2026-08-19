export const getArchiveThumbnail = (category: string, title?: string): string => {
  const t = (title || "").toLowerCase();
  const c = (category || "").toLowerCase();

  if (t.includes("war") && t.includes("room")) {
    return "https://archive.org/download/daily-highlights/warroom.png";
  }
  if (t.includes("alex") && t.includes("jones")) {
    return "https://archive.org/download/daily-highlights/gettyimages-1796841914.webp";
  }
  if (
    t.includes("sunday night live") ||
    t.includes("saturday special") ||
    t.includes("special")
  ) {
    return "https://archive.org/download/daily-highlights/liberty%20moonlight.png";
  }
  if (c.includes("live") || t.includes("live") || t.includes("transmission") || t.includes("primetime")) {
    return "https://archive.org/download/daily-highlights/liberty%20moonlight.png";
  }
  if (
    t.includes("news") ||
    t.includes("nightly") ||
    t.includes("sept11") ||
    t.includes("weather") ||
    t.includes("emergency") ||
    t.includes("bulletin") ||
    t.includes("ticker") ||
    t.includes("report")
  ) {
    return "https://archive.org/download/daily-highlights/emegency.png";
  }
  if (
    c.includes("audio") ||
    t.includes("audio") ||
    t.includes("sax") ||
    t.includes("session") ||
    t.includes("podcast")
  ) {
    return "https://archive.org/download/daily-highlights/imageedit_23_4429835337.png";
  }
  if (
    t.includes("bohemian") ||
    t.includes("police") ||
    t.includes("obama") ||
    t.includes("deception") ||
    t.includes("expose") ||
    t.includes("classic") ||
    t.includes("bumper") ||
    t.includes("archive") ||
    t.includes("history") ||
    c.includes("bumper") ||
    t.includes("station id") ||
    t.includes("promo") ||
    t.includes("infowars")
  ) {
    return "https://archive.org/download/daily-highlights/old-tv-television-empty-screen-2-cover.jpg";
  }
  if (t.includes("daily") || t.includes("highlight")) {
    return "https://archive.org/download/daily-highlights/web%20app1.png";
  }
  return "https://archive.org/download/daily-highlights/liberty%20moonlight.png";
};
