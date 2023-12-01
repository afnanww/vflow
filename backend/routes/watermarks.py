"""
Watermark API routes
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import os
import logging

from backend.database import get_db
from backend.models import Video
from backend.schemas import (
    WatermarkApplyRequest,
    WatermarkApplyResponse,
    WatermarkPreviewRequest,
    WatermarkPreviewResponse,
    VideoResponse
)
from backend.services.watermark_service import watermark_service
from backend.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/videos", response_model=List[VideoResponse])
async def list_videos(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    List available videos for watermarking
    """
    try:
        videos = db.query(Video).filter(
            Video.file_path.isnot(None)
        ).order_by(Video.created_at.desc()).limit(limit).all()
        
        return videos
    except Exception as e:
        logger.error(f"Error listing videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply", response_model=WatermarkApplyResponse)
async def apply_watermark(
    request: WatermarkApplyRequest,
    db: Session = Depends(get_db)
):
    """
    Apply watermark to a video
    """
    try:
        # Get video from database
        video = db.query(Video).filter(Video.id == request.video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if not video.file_path or not os.path.exists(video.file_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Validate watermark text
        if not request.config.text or not request.config.text.strip():
            raise HTTPException(status_code=400, detail="Watermark text cannot be empty")
        
        # Generate output path
        base_name = os.path.splitext(video.file_path)[0]
        output_path = f"{base_name}_watermarked.mp4"
        
        # Apply watermark
        success = watermark_service.apply_watermark(
            video_path=video.file_path,
            output_path=output_path,
            text=request.config.text,
            position=request.config.position,
            font_size=request.config.font_size,
            color=request.config.color,
            opacity=request.config.opacity,
            enable_box=request.config.enable_box,
            box_color=request.config.box_color,
            box_opacity=request.config.box_opacity,
            custom_x=request.config.custom_x,
            custom_y=request.config.custom_y
        )
        
        if success:
            return WatermarkApplyResponse(
                success=True,
                output_path=output_path
            )
        else:
            return WatermarkApplyResponse(
                success=False,
                error_message="Failed to apply watermark"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying watermark: {e}")
        return WatermarkApplyResponse(
            success=False,
            error_message=str(e)
        )


@router.post("/preview", response_model=WatermarkPreviewResponse)
async def generate_preview(
    request: WatermarkPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a preview frame with watermark
    """
    try:
        # Get video from database
        video = db.query(Video).filter(Video.id == request.video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if not video.file_path or not os.path.exists(video.file_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Validate watermark text
        if not request.config.text or not request.config.text.strip():
            raise HTTPException(status_code=400, detail="Watermark text cannot be empty")
        
        # Generate preview path
        preview_dir = os.path.join(settings.STORAGE_PATH, "previews")
        os.makedirs(preview_dir, exist_ok=True)
        
        preview_filename = f"preview_{request.video_id}_{hash(request.config.text)}.jpg"
        preview_path = os.path.join(preview_dir, preview_filename)
        
        # Generate preview
        success = watermark_service.generate_preview_frame(
            video_path=video.file_path,
            output_path=preview_path,
            text=request.config.text,
            position=request.config.position,
            font_size=request.config.font_size,
            color=request.config.color,
            opacity=request.config.opacity,
            enable_box=request.config.enable_box,
            box_color=request.config.box_color,
            box_opacity=request.config.box_opacity,
            custom_x=request.config.custom_x,
            custom_y=request.config.custom_y,
            timestamp=request.timestamp
        )
        
        if success:
            # Return relative URL for preview
            preview_url = f"/storage/previews/{preview_filename}"
            return WatermarkPreviewResponse(
                success=True,
                preview_url=preview_url
            )
        else:
            return WatermarkPreviewResponse(
                success=False,
                error_message="Failed to generate preview"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating preview: {e}")
        return WatermarkPreviewResponse(
            success=False,
            error_message=str(e)
        )


@router.post("/download/{video_id}")
async def download_watermarked_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Get download URL for watermarked video
    """
    try:
        from fastapi.responses import FileResponse
        
        # Get video from database
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if not video.file_path or not os.path.exists(video.file_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Check for watermarked version
        base_name = os.path.splitext(video.file_path)[0]
        watermarked_path = f"{base_name}_watermarked.mp4"
        
        if os.path.exists(watermarked_path):
            return FileResponse(
                watermarked_path,
                media_type="video/mp4",
                filename=os.path.basename(watermarked_path)
            )
        else:
            raise HTTPException(status_code=404, detail="Watermarked video not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading watermarked video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open-folder/{video_id}")
async def open_watermarked_folder(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Open folder containing watermarked video
    """
    try:
        import subprocess
        import platform
        
        # Get video from database
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if not video.file_path or not os.path.exists(video.file_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Check for watermarked version
        base_name = os.path.splitext(video.file_path)[0]
        watermarked_path = f"{base_name}_watermarked.mp4"
        
        if not os.path.exists(watermarked_path):
            raise HTTPException(status_code=404, detail="Watermarked video not found")
        
        # Get directory
        folder_path = os.path.dirname(watermarked_path)
        
        # Open folder based on OS
        system = platform.system()
        if system == "Windows":
            # Open folder and select file
            subprocess.run(['explorer', '/select,', watermarked_path])
        elif system == "Darwin":  # macOS
            subprocess.run(['open', '-R', watermarked_path])
        else:  # Linux
            subprocess.run(['xdg-open', folder_path])
        
        return {"success": True, "message": "Folder opened"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

