import requests
from bs4 import BeautifulSoup
import re
from logger import logger
import config

class ScraperException(Exception):
    pass

def scrape_embed(embed_url=config.PRIMARY_EMBED_URL, timeout=config.EMBED_TIMEOUT):
    """
    Scrapes the embed page and extracts the video source.
    Returns: video_source_url (str) or raises ScraperException
    """
    logger.info(f"Scraping primary embed URL: {embed_url}")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(embed_url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for iframe src containing rumble.com/embed
        iframes = soup.find_all('iframe')
        for iframe in iframes:
            src = iframe.get('src')
            if src and 'rumble.com/embed' in src:
                logger.info(f"Successfully extracted embed URL: {src}")
                return src
                
        # Regex fallback
        match = re.search(r'src="(https://rumble\.com/embed/[^"]+)"', response.text)
        if match:
            extracted = match.group(1)
            logger.info(f"Successfully extracted embed URL via regex: {extracted}")
            return extracted
            
        raise ScraperException("Could not find a valid video iframe or source in the page.")
        
    except requests.RequestException as e:
        logger.error(f"Failed to scrape {embed_url}: {str(e)}")
        raise ScraperException(f"Network error while scraping: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error while scraping {embed_url}: {str(e)}")
        raise ScraperException(f"Error while scraping: {str(e)}")
