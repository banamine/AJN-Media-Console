from logger import logger

def play_stream(source_url, source_type="m3u"):
    """
    Initiates playback of the given stream source.
    source_type determines how the stream is handled.
    In a real app, this would integrate with VLC, ffmpeg, or a browser engine.
    Here we simulate it with logging.
    """
    logger.info(f"--- PLAYBACK INITIATED ---")
    logger.info(f"Type: {source_type.upper()}")
    logger.info(f"Source: {source_url}")
    logger.info(f"--------------------------")
    return True

def stop_playback():
    """
    Stops current playback.
    """
    logger.info("Playback stopped.")
