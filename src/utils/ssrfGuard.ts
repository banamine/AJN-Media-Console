/**
 * SSRF Guard helper. Verifies if a given URL is safe to fetch from server-side.
 * Prevents accessing internal/private IP ranges (RFC 1918, localhost, loopbacks, etc.)
 */
import { URL } from "url";

export function isUrlSafe(urlString: string): boolean {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const parsed = new URL(urlString.trim());
    
    // Only allow HTTP/HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block common local/private hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }

    // IP address checks
    // Check for standard private IP ranges (IPv4)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (link-local)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const p1 = parseInt(match[1]);
      const p2 = parseInt(match[2]);
      if (
        p1 === 10 ||
        (p1 === 172 && p2 >= 16 && p2 <= 31) ||
        (p1 === 192 && p2 === 168) ||
        (p1 === 169 && p2 === 254) ||
        p1 === 127 ||
        p1 === 0
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
