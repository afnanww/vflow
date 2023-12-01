"""
Download API routes
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import logging
import asyncio
import functools
import os
import sys
import subprocess
import platform

from backend.database import get_db
from backend.schemas import (
    DownloadCreate, DownloadResponse, BulkDownloadRequest, BulkDownloadResponse,
    ChannelScanResult, VideoResponse
)
from backend.models import Download, Video, Channel, DownloadStatus, PlatformType
from backend.services.downloader import downloader
from backend.services.scanner_service import scanner
from backend.services.progress_tracker import progress_tracker
from backend.utils.platform_detector import detect_platform, is_channel_url

router = APIRouter()
logger = logging.getLogger(__name__)


async def download_video_task(download_id: int, url: str, options: dict, db: Session):
    """Background task for downloading video"""
    try:
        # Update status to downloading
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            return
        
        download.status = DownloadStatus.DOWNLOADING
        db.commit()
        
        # Progress callback wrapper to be called from sync code
        def sync_progress_callback(progress: float, status: str):
            asyncio.run_coroutine_threadsafe(
                progress_tracker.send_progress(download_id, progress, status),
                loop
            )
            
            # We can't easily update DB here safely from another thread without a new session
            # So we rely on the WebSocket for real-time updates and update DB at the end
            # or use a separate DB session if strictly needed.
            # For now, we'll just send WS updates.
        
        # Get the current event loop
        loop = asyncio.get_running_loop()
        
        # Run blocking download in thread pool
        result = await loop.run_in_executor(
            None,
            functools.partial(
                downloader.download_video,
                url,
                download_subtitles=options.get('download_subtitles', False),
                subtitle_lang=options.get('subtitle_language', 'en'),
                quality=options.get('quality', 'best'),
                progress_callback=sync_progress_callback
            )
        )
        
        if result:
            # Re-query download to ensure we have latest state
            download = db.query(Download).filter(Download.id == download_id).first()
            
            # Create or update video record
            platform = detect_platform(url)
            video = db.query(Video).filter(Video.url == url).first()
            
            if not video:
                video = Video(
                    title=result['info']['title'],
                    url=url,
                    platform=platform,
                    thumbnail_url=result['info'].get('thumbnail_url'),
                    duration=result['info'].get('duration'),
                    views=result['info'].get('views'),
                    upload_date=result['info'].get('upload_date'),
                    description=result['info'].get('description'),
                    file_path=result['video_file'],
                    file_size=result['file_size'],
                    has_subtitles=len(result['subtitle_files']) > 0,
                    watermark_removed=options.get('remove_watermark', True)
                )
                db.add(video)
                db.commit()
                db.refresh(video)
            
            # Update download record
            download.status = DownloadStatus.COMPLETED
            download.progress = 100.0
            download.video_id = video.id
            db.commit()
            
            await progress_tracker.send_progress(download_id, 100.0, 'completed', 'Download completed')
        else:
            # Download failed
            download = db.query(Download).filter(Download.id == download_id).first()
            download.status = DownloadStatus.FAILED
            download.error_message = "Download failed"
            db.commit()
            
            await progress_tracker.send_progress(download_id, 0, 'failed', 'Download failed')
    
    except Exception as e:
        logger.error(f"Error in download task: {e}")
        # Re-query in case of session issues
        try:
            download = db.query(Download).filter(Download.id == download_id).first()
            if download:
                download.status = DownloadStatus.FAILED
                download.error_message = str(e)
                db.commit()
        except:
            pass
        
        await progress_tracker.send_progress(download_id, 0, 'failed', str(e))


@router.post("/single", response_model=DownloadResponse)
async def download_single_video(
    request: DownloadCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Download a single video"""
    # Detect platform
    platform = detect_platform(request.url)
    if not platform:
        raise HTTPException(status_code=400, detail="Unsupported platform or invalid URL")
    
    # Check if it's a channel URL
    if is_channel_url(request.url):
        raise HTTPException(status_code=400, detail="This appears to be a channel URL. Use the channel scan endpoint instead.")
    
    # Create download record
    download = Download(
        url=request.url,
        status=DownloadStatus.PENDING,
        download_options=request.options.dict() if request.options else {}
    )
    db.add(download)
    db.commit()
    db.refresh(download)
    
    # Start background download task
    background_tasks.add_task(
        download_video_task,
        download.id,
        request.url,
        download.download_options,
        db
    )
    
    return download


@router.get("/info")
async def get_video_info(url: str):
    """Get video info without downloading"""
    print(f"DEBUG: Received info request for url: {url}")
    loop = asyncio.get_running_loop()
    
    # Run blocking info extraction in thread pool
    info = await loop.run_in_executor(
        None,
        scanner.get_video_info,
        url
    )
    
    # DEBUG: Return dummy info
    # info = {
    #     'title': 'Test Video',
    #     'url': url,
    #     'thumbnail_url': 'https://via.placeholder.com/150',
    #     'duration': 120,
    #     'views': '1000',
    #     'upload_date': '20230101',
    #     'description': 'Test description',
    #     'uploader': 'Test Uploader',
    #     'channel_id': 'test_channel',
    #     'channel_url': 'http://test.com'
    # }
    
    if not info:
        raise HTTPException(status_code=404, detail="Video info not found")
        
    return info


@router.post("/channel/scan", response_model=ChannelScanResult)
async def scan_channel(
    url: str,
    max_videos: int = 50,
    db: Session = Depends(get_db)
):
    """Scan a channel and get video list"""
    # Detect platform
    platform = detect_platform(url)
    if not platform:
        raise HTTPException(status_code=400, detail="Unsupported platform or invalid URL")
    
    # Scan channel in thread pool
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None,
            functools.partial(scanner.scan_channel, url, max_videos)
        )
    except Exception as e:
        with open("scan_error.log", "w") as f:
            f.write(f"Error scanning channel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")
    
    if not result:
        with open("scan_error.log", "w") as f:
            f.write("Scan returned empty result")
        raise HTTPException(status_code=500, detail="Failed to scan channel")
    
    # Create or update channel record
    channel = db.query(Channel).filter(Channel.url == url).first()
    
    if not channel:
        channel = Channel(
            name=result['channel_name'],
            url=url,
            platform=platform,
            channel_id=result.get('channel_id'),
            description=result.get('description'),
            subscribers=result.get('subscriber_count'),
            last_sync=func.now()
        )
        db.add(channel)
    else:
        # Update existing channel
        channel.name = result['channel_name']
        channel.description = result.get('description')
        channel.subscribers = result.get('subscriber_count')
        channel.last_sync = func.now()
    
    db.commit()
    db.refresh(channel)
    
    # Save videos to database
    saved_videos = []
    for video_data in result['videos']:
        # Check if video already exists
        existing_video = db.query(Video).filter(Video.url == video_data['url']).first()
        
        if not existing_video:
            video = Video(
                title=video_data['title'],
                url=video_data['url'],
                platform=platform,
                thumbnail_url=video_data.get('thumbnail_url'),
                duration=video_data.get('duration'),
                views=video_data.get('views'),
                upload_date=video_data.get('upload_date'),
                channel_id=channel.id,
            )
            db.add(video)
            db.flush()  # Get the ID
            saved_videos.append(video)
        else:
            # Update channel_id if not set
            if not existing_video.channel_id:
                existing_video.channel_id = channel.id
            saved_videos.append(existing_video)
    
    db.commit()
    
    # Convert videos to response format
    videos = []
    for video in saved_videos:
        videos.append(VideoResponse(
            id=video.id,
            title=video.title,
            url=video.url,
            platform=video.platform,
            thumbnail_url=video.thumbnail_url,
            duration=video.duration,
            views=video.views,
            upload_date=video.upload_date,
            created_at=video.created_at
        ))
    
    return ChannelScanResult(
        channel=channel,
        videos=videos,
        total_videos=result['total_videos']
    )


@router.post("/bulk", response_model=BulkDownloadResponse)
async def bulk_download(
    request: BulkDownloadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Download multiple videos"""
    download_ids = []
    
    for url in request.video_urls:
        # Create download record
        download = Download(
            url=url,
            status=DownloadStatus.PENDING,
            download_options=request.options.dict() if request.options else {}
        )
        db.add(download)
        db.commit()
        db.refresh(download)
        
        download_ids.append(download.id)
        
        # Start background download task
        background_tasks.add_task(
            download_video_task,
            download.id,
            url,
            download.download_options,
            db
        )
    
    return BulkDownloadResponse(
        total=len(request.video_urls),
        started=len(download_ids),
        download_ids=download_ids
    )


@router.get("/{download_id}", response_model=DownloadResponse)
async def get_download_status(download_id: int, db: Session = Depends(get_db)):
    """Get download status"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    return download


@router.delete("/{download_id}")
async def cancel_download(download_id: int, db: Session = Depends(get_db)):
    """Cancel/delete a download"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    # Update status to cancelled
    download.status = DownloadStatus.CANCELLED
    db.commit()
    
    # Clear progress
    progress_tracker.clear_progress(download_id)
    
    return {"message": "Download cancelled"}


@router.websocket("/progress")
async def websocket_progress(websocket: WebSocket):
    """WebSocket endpoint for real-time progress updates"""
    await progress_tracker.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        progress_tracker.disconnect(websocket)


@router.post("/{download_id}/play")
async def play_video(download_id: int, db: Session = Depends(get_db)):
    """Get video URL for playback"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    if not download.video or not download.video.file_path:
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_path = download.video.file_path
    
    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")
    
    # Get the filename from the absolute path
    filename = os.path.basename(file_path)
    
    # Determine which subdirectory (videos, subtitles, thumbnails)
    # The file should be in storage/videos/
    if "videos" in file_path:
        video_url = f"http://localhost:8000/storage/videos/{filename}"
    elif "subtitles" in file_path:
        video_url = f"http://localhost:8000/storage/subtitles/{filename}"
    else:
        # Default to videos directory
        video_url = f"http://localhost:8000/storage/videos/{filename}"
    
    return {"url": video_url, "type": "video/mp4"}


@router.post("/{download_id}/open-folder")
async def open_video_folder(download_id: int, db: Session = Depends(get_db)):
    """Open the folder containing the video"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    if not download.video or not download.video.file_path:
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_path = download.video.file_path
    folder_path = os.path.dirname(file_path)
    
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail="Folder does not exist on disk")
        
    try:
        if platform.system() == 'Windows':
            os.startfile(folder_path)
        elif platform.system() == 'Darwin':  # macOS
            subprocess.call(('open', folder_path))
        else:  # Linux
            subprocess.call(('xdg-open', folder_path))
        return {"message": "Folder opened"}
    except Exception as e:
        logger.error(f"Failed to open folder: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")


@router.get("/videos/all", response_model=List[VideoResponse])
async def get_all_downloaded_videos(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all downloaded videos with file paths"""
    videos = db.query(Video).filter(
        Video.file_path.isnot(None)
    ).order_by(
        Video.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return videos

