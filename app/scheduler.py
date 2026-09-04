import asyncio
import logging
from app.database import cleanup_expired

logger = logging.getLogger("passdrop.scheduler")


async def periodic_cleanup_task(interval_seconds: int = 600):
    """
    Background task that periodically cleans up expired or exhausted password records.
    Defaults to running every 10 minutes.
    """
    logger.info("Starting PassDrop periodic cleanup task...")
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            deleted_count = cleanup_expired()
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired/exhausted password records.")
        except asyncio.CancelledError:
            logger.info("Cleanup task cancelled, shutting down.")
            break
        except Exception as e:
            logger.error(f"Error during periodic cleanup: {e}", exc_info=True)
            await asyncio.sleep(10)
