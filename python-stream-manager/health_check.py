import requests
import datetime
from logger import logger
import config

def check_m3u_health(m3u_url, timeout=config.M3U_TIMEOUT):
    """
    Validates m3u stream health and expiration status.
    Returns: { "status": str, "details": str, "is_recorded": bool }
    """
    logger.info(f"Checking M3U health for: {m3u_url}")
    result = {
        "status": "failed",
        "details": "",
        "is_recorded": False
    }
    
    try:
        response = requests.get(m3u_url, timeout=timeout)
        if response.status_code == 200:
            content = response.text
            if "#EXTM3U" not in content:
                result["details"] = "Not a valid M3U playlist"
                return result
                
            # Check if it has ended (VOD style)
            if "#EXT-X-ENDLIST" in content:
                result["status"] = "recorded"
                result["details"] = "Playlist has ended (EXT-X-ENDLIST present)"
                result["is_recorded"] = True
                return result
                
            # Naive time-based check for expiration (per requirements)
            now = datetime.datetime.now().time()
            end_time_obj = datetime.datetime.strptime(config.VIDEO_END_TIME, "%H:%M:%S").time()
            
            if now >= end_time_obj:
                result["status"] = "expired"
                result["details"] = f"Current time ({now}) exceeds VIDEO_END_TIME ({end_time_obj})"
                result["is_recorded"] = True
                return result
                
            result["status"] = "live"
            result["details"] = "Stream is active and live"
        elif response.status_code == 404 or response.status_code == 403:
            result["status"] = "expired"
            result["details"] = f"Stream returned {response.status_code}, likely expired or forbidden"
            result["is_recorded"] = True
        else:
            result["details"] = f"HTTP {response.status_code}"
            
    except requests.RequestException as e:
        result["details"] = f"Network error: {str(e)}"
        
    return result

def check_embed_health(embed_url, timeout=config.EMBED_TIMEOUT):
    """
    Validates embed accessibility and extracts video source.
    Returns: { "status": "active" | "failed", "source_url": str, "details": str }
    """
    logger.info(f"Checking embed health for: {embed_url}")
    result = {
        "status": "failed",
        "source_url": embed_url,
        "details": ""
    }
    
    try:
        # We just check if the URL returns a 200 OK
        headers = {
            "User-Agent": "Mozilla/5.0"
        }
        response = requests.get(embed_url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            result["status"] = "active"
            result["details"] = "Embed is accessible"
        else:
            result["details"] = f"HTTP {response.status_code}"
    except requests.RequestException as e:
        result["details"] = f"Network error: {str(e)}"
        
    return result
