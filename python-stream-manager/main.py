import time
from logger import logger
from failover import failover_manager
from player import stop_playback

def main():
    logger.info("Initializing Video Stream Manager...")
    
    # Initialize state machine / failover manager (check every 60s for demo)
    manager = failover_manager(check_interval=60)
    
    try:
        # Start background monitoring
        manager.start()
        
        # Interactive shell for simulation
        while True:
            cmd = input("\nEnter command (status, stop, exit): ").strip().lower()
            if cmd == "exit":
                break
            elif cmd == "status":
                print(f"\n--- Current Status ---")
                print(f"State: {manager.state}")
                print(f"Active Source: {manager.active_source}")
                print(f"----------------------\n")
            elif cmd == "stop":
                manager.stop()
                stop_playback()
            elif cmd == "start":
                manager.start()
            else:
                print("Unknown command.")
                
    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    finally:
        logger.info("Shutting down...")
        manager.stop()
        stop_playback()

if __name__ == "__main__":
    main()
