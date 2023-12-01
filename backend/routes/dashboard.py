"""
Dashboard API routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging
import os

from backend.database import get_db
from backend.schemas import DashboardStats, ActivityItem
from backend.models import Video, Channel, Download, DownloadStatus
from backend.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    # Count total downloads
    total_downloads = db.query(Download).filter(
        Download.status == DownloadStatus.COMPLETED
    ).count()
    
    # Count active tasks
    active_tasks = db.query(Download).filter(
        Download.status.in_([DownloadStatus.DOWNLOADING, DownloadStatus.PROCESSING])
    ).count()
    
    # Count total videos
    total_videos = db.query(Video).count()
    
    # Count total channels
    total_channels = db.query(Channel).filter(Channel.is_active == True).count()
    
    # Calculate storage usage
    storage_used_bytes = 0
    videos_path = os.path.join(settings.STORAGE_PATH, "videos")
    
    if os.path.exists(videos_path):
        for filename in os.listdir(videos_path):
            file_path = os.path.join(videos_path, filename)
            if os.path.isfile(file_path):
                storage_used_bytes += os.path.getsize(file_path)
    
    storage_used_gb = storage_used_bytes / (1024 ** 3)
    storage_total_gb = settings.MAX_STORAGE_GB
    
    return DashboardStats(
        total_downloads=total_downloads,
        storage_used_gb=round(storage_used_gb, 2),
        storage_total_gb=storage_total_gb,
        active_tasks=active_tasks,
        total_videos=total_videos,
        total_channels=total_channels
    )


@router.get("/activity")
async def get_recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    """Get recent download activity"""
    downloads = db.query(Download).order_by(
        Download.created_at.desc()
    ).limit(limit).all()
    
    activity = []
    for download in downloads:
        # Get video info if available
        video = download.video
        
        # Calculate time ago
        from datetime import datetime, timezone
        if download.created_at.tzinfo:
            time_diff = datetime.now(timezone.utc) - download.created_at
        else:
            time_diff = datetime.now() - download.created_at
        
        if time_diff.seconds < 60:
            time_ago = "Just now"
        elif time_diff.seconds < 3600:
            minutes = time_diff.seconds // 60
            time_ago = f"{minutes} min{'s' if minutes > 1 else ''} ago"
        elif time_diff.seconds < 86400:
            hours = time_diff.seconds // 3600
            time_ago = f"{hours} hour{'s' if hours > 1 else ''} ago"
        else:
            days = time_diff.days
            time_ago = f"{days} day{'s' if days > 1 else ''} ago"
        
        # Get file size
        size = "0 MB"
        if video and video.file_size:
            size_mb = video.file_size / (1024 * 1024)
            if size_mb < 1024:
                size = f"{int(size_mb)} MB"
            else:
                size_gb = size_mb / 1024
                size = f"{size_gb:.1f} GB"
        
        activity.append(ActivityItem(
            id=download.id,
            title=video.title if video else "Unknown Video",
            platform=video.platform.value if video else "unknown",
            status=download.status.value,
            time=time_ago,
            size=size,
            progress=download.progress if download.status == DownloadStatus.DOWNLOADING else None,
            error=download.error_message if download.status == DownloadStatus.FAILED else None
        ))
    
    return activity


@router.get("/channels")
async def get_channel_activity(db: Session = Depends(get_db)):
    """Get channel activity statistics"""
    channels = db.query(Channel).filter(Channel.is_active == True).all()
    
    channel_stats = []
    for channel in channels:
        # Count videos for this channel
        video_count = db.query(Video).filter(Video.channel_id == channel.id).count()
        
        # Count downloaded videos
        downloaded_count = db.query(Video).join(Download).filter(
            Video.channel_id == channel.id,
            Download.status == DownloadStatus.COMPLETED
        ).count()
        
        channel_stats.append({
            'id': channel.id,
            'name': channel.name,
            'platform': channel.platform.value,
            'total_videos': video_count,
            'downloaded_videos': downloaded_count,
            'last_sync': channel.last_sync.isoformat() if channel.last_sync else None
        })
    
    return channel_stats
