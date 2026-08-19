import time
import threading
from logger import logger
import config
from health_check import check_m3u_health, check_embed_health
from scraper import scrape_embed, ScraperException
from player import play_stream

class StateMachine:
    M3U_LIVE = "M3U Live"
    BACKUP_M3U = "Backup M3U"
    EMBED_ACTIVE = "Embed Active"
    BACKUP_EMBED = "Backup Embed"
    ERROR = "Error State"

class FailoverManager:
    def __init__(self, check_interval=300):
        self.check_interval = check_interval
        self.state = StateMachine.M3U_LIVE
        self.active_source = config.PRIMARY_M3U_URL
        self.running = False
        self.thread = None
        self.current_embed_url = None

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.thread.start()
            logger.info("Failover manager started.")
            # Initial play
            self._transition(self.state)

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
            logger.info("Failover manager stopped.")

    def _transition(self, new_state, source_url=None, source_type="m3u"):
        if self.state != new_state or self.active_source != source_url:
            logger.info(f"Transitioning from {self.state} to {new_state}")
            self.state = new_state
            if source_url:
                self.active_source = source_url
                play_stream(self.active_source, source_type)
        else:
            logger.debug(f"State remains {self.state}")

    def _monitor_loop(self):
        while self.running:
            self._evaluate_state()
            time.sleep(self.check_interval)

    def _evaluate_state(self):
        logger.debug(f"Evaluating state: {self.state}")
        
        if self.state == StateMachine.M3U_LIVE:
            health = check_m3u_health(config.PRIMARY_M3U_URL)
            if health["status"] == "live":
                # Healthy, continue
                self._transition(StateMachine.M3U_LIVE, config.PRIMARY_M3U_URL, "m3u")
            elif health["is_recorded"] or health["status"] == "expired":
                # Recorded/Expired -> Embed
                self._try_embed()
            else:
                # Failure -> Backup M3U
                logger.warning(f"Primary M3U failed: {health['details']}")
                self._transition(StateMachine.BACKUP_M3U, config.BACKUP_M3U_URL, "m3u")

        elif self.state == StateMachine.BACKUP_M3U:
            health = check_m3u_health(config.BACKUP_M3U_URL)
            if health["status"] == "live":
                self._transition(StateMachine.BACKUP_M3U, config.BACKUP_M3U_URL, "m3u")
            else:
                # Backup failed or recorded -> Embed
                logger.warning(f"Backup M3U failed or recorded: {health['details']}")
                self._try_embed()

        elif self.state == StateMachine.EMBED_ACTIVE:
            if not self.current_embed_url:
                self._try_embed()
                return
                
            health = check_embed_health(self.current_embed_url)
            if health["status"] == "active":
                self._transition(StateMachine.EMBED_ACTIVE, self.current_embed_url, "embed")
            else:
                logger.warning(f"Primary embed failed: {health['details']}")
                self._transition(StateMachine.BACKUP_EMBED, config.BACKUP_EMBED_URL, "embed")

        elif self.state == StateMachine.BACKUP_EMBED:
            health = check_embed_health(config.BACKUP_EMBED_URL)
            if health["status"] == "active":
                self._transition(StateMachine.BACKUP_EMBED, config.BACKUP_EMBED_URL, "embed")
            else:
                logger.error("All sources failed. Entering error state.")
                self._transition(StateMachine.ERROR, None, "none")
                
        elif self.state == StateMachine.ERROR:
            # Try to recover by starting from scratch
            logger.info("Attempting recovery from error state...")
            self.state = StateMachine.M3U_LIVE
            self._evaluate_state()

    def _try_embed(self):
        try:
            embed_url = scrape_embed()
            self.current_embed_url = embed_url
            self._transition(StateMachine.EMBED_ACTIVE, embed_url, "embed")
        except ScraperException as e:
            logger.error(f"Scraper failed: {e}")
            self._transition(StateMachine.BACKUP_EMBED, config.BACKUP_EMBED_URL, "embed")

def failover_manager(check_interval=300):
    manager = FailoverManager(check_interval)
    return manager
