"""
Channel API routes
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import logging
import asyncio
import functools

from backend.database import get_db
from backend.schemas import ChannelResponse, ChannelScanResult
from backend.models import Channel, Video, Download, DownloadStatus
from backend.services.downloader import downloader
from backend.services.scanner_service import scanner
from backend.utils.platform_detector import detect_platform

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def list_channels(db: Session = Depends(get_db)):
    """List all saved channels with video counts"""
    channels = db.query(Channel).filter(Channel.is_active == True).order_by(Channel.last_sync.desc()).all()
    
    result = []
    for channel in channels:
        video_count = db.query(Video).filter(Video.channel_id == channel.id).count()
        result.append({
            "id": channel.id,
            "name": channel.name,
            "url": channel.url,
            "platform": channel.platform,
            "avatar_url": channel.avatar_url,
            "subscribers": channel.subscribers,
            "video_count": video_count,
            "last_sync": channel.last_sync.isoformat() if channel.last_sync else None,
            "created_at": channel.created_at.isoformat() if channel.created_at else None,
        })
    
    return {"channels": result}


@router.get("/{channel_id}")
async def get_channel_detail(channel_id: int, db: Session = Depends(get_db)):
    """Get channel details with all videos and their statuses"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get all videos for this channel
    videos = db.query(Video).filter(Video.channel_id == channel_id).order_by(Video.created_at.desc()).all()
    
    video_list = []
    for video in videos:
        video_list.append({
            "id": video.id,
            "title": video.title,
            "url": video.url,
            "platform": video.platform,
            "thumbnail_url": video.thumbnail_url,
            "duration": video.duration,
            "views": video.views,
            "upload_date": video.upload_date,
            "download_status": getattr(video, 'download_status', 'pending'),
            "processing_status": getattr(video, 'processing_status', 'none'),
            "upload_platforms": getattr(video, 'upload_platforms', {}),
            "file_path": video.file_path,
            "created_at": video.created_at.isoformat() if video.created_at else None,
        })
    
    return {
        "channel": {
            "id": channel.id,
            "name": channel.name,
            "url": channel.url,
            "platform": channel.platform,
            "avatar_url": channel.avatar_url,
            "subscribers": channel.subscribers,
            "description": channel.description,
            "last_sync": channel.last_sync.isoformat() if channel.last_sync else None,
            "created_at": channel.created_at.isoformat() if channel.created_at else None,
        },
        "videos": video_list,
        "total_videos": len(video_list)
    }


@router.delete("/{channel_id}")
async def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    """Delete a channel (soft delete)"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    channel.is_active = False
    db.commit()
    
    return {"message": "Channel deleted"}


@router.post("/{channel_id}/sync", response_model=ChannelScanResult)
async def sync_channel(
    channel_id: int,
    max_videos: int = 50,
    db: Session = Depends(get_db)
):
    """Sync/rescan a channel"""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Scan channel in thread pool
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        functools.partial(scanner.scan_channel, channel.url, max_videos)
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to scan channel")
    
    # Update channel info
    channel.name = result['channel_name']
    channel.description = result.get('description')
    channel.subscribers = result.get('subscriber_count')
    channel.last_sync = func.now()
    db.commit()
    db.refresh(channel)
    
    # We don't automatically add videos to DB here, just return them
    # The user can choose to download them which will add them to DB
    
    # Convert videos to response format (using dicts as they are not in DB yet)
    # But we need to return VideoResponse objects for the schema
    # We'll construct them manually
    from schemas import VideoResponse
    videos = []
    for video_data in result['videos']:
        videos.append(VideoResponse(
            id=0,
            title=video_data['title'],
            url=video_data['url'],
            platform=channel.platform,
            thumbnail_url=video_data.get('thumbnail_url'),
            duration=video_data.get('duration'),
            views=video_data.get('views'),
            upload_date=video_data.get('upload_date'),
            created_at=channel.created_at
        ))
    
    return ChannelScanResult(
        channel=channel,
        videos=videos,
        total_videos=result['total_videos']
    )
