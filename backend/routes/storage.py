"""
Storage management API routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import logging
import os
import shutil

from backend.database import get_db
from backend.schemas import StorageStats
from backend.models import Video, Subtitle
from backend.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=StorageStats)
async def get_storage_stats(db: Session = Depends(get_db)):
    """Get storage usage statistics"""
    storage_path = settings.STORAGE_PATH
    
    # Get total disk space
    total, used, free = shutil.disk_usage(storage_path)
    
    # Calculate storage used by videos
    videos_size = 0
    videos_path = os.path.join(storage_path, "videos")
    if os.path.exists(videos_path):
        for filename in os.listdir(videos_path):
            file_path = os.path.join(videos_path, filename)
            if os.path.isfile(file_path):
                videos_size += os.path.getsize(file_path)
    
    # Calculate storage used by subtitles
    subtitles_size = 0
    subtitles_path = os.path.join(storage_path, "subtitles")
    if os.path.exists(subtitles_path):
        for filename in os.listdir(subtitles_path):
            file_path = os.path.join(subtitles_path, filename)
            if os.path.isfile(file_path):
                subtitles_size += os.path.getsize(file_path)
    
    # Count files
    videos_count = db.query(Video).count()
    subtitles_count = db.query(Subtitle).count()
    
    # Convert to GB
    total_gb = settings.MAX_STORAGE_GB
    used_gb = (videos_size + subtitles_size) / (1024 ** 3)
    free_gb = total_gb - used_gb
    usage_percentage = (used_gb / total_gb) * 100 if total_gb > 0 else 0
    
    return StorageStats(
        total_gb=total_gb,
        used_gb=round(used_gb, 2),
        free_gb=round(free_gb, 2),
        usage_percentage=round(usage_percentage, 2),
        videos_count=videos_count,
        subtitles_count=subtitles_count
    )


@router.delete("/cleanup")
async def cleanup_storage(
    older_than_days: int = 30,
    db: Session = Depends(get_db)
):
    """Clean up old files"""
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.now() - timedelta(days=older_than_days)
    
    # Find old videos
    old_videos = db.query(Video).filter(Video.created_at < cutoff_date).all()
    
    deleted_count = 0
    freed_space = 0
    
    for video in old_videos:
        if video.file_path and os.path.exists(video.file_path):
            try:
                file_size = os.path.getsize(video.file_path)
                os.remove(video.file_path)
                freed_space += file_size
                deleted_count += 1
                
                # Delete video record
                db.delete(video)
            except Exception as e:
                logger.error(f"Error deleting video file: {e}")
    
    db.commit()
    
    freed_space_mb = freed_space / (1024 * 1024)
    
    return {
        "message": "Cleanup completed",
        "deleted_files": deleted_count,
        "freed_space_mb": round(freed_space_mb, 2)
    }
