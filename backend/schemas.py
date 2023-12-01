from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class PlatformType(str, Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    DOUYIN = "douyin"


class DownloadStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


# Base Schemas
class VideoBase(BaseModel):
    title: str
    url: str
    platform: PlatformType
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    views: Optional[str] = None
    upload_date: Optional[str] = None
    description: Optional[str] = None


class VideoCreate(VideoBase):
    pass


class VideoResponse(VideoBase):
    id: int
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    has_subtitles: bool = False
    watermark_removed: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


# Download Schemas
class DownloadOptions(BaseModel):
    remove_watermark: bool = True
    download_subtitles: bool = False
    subtitle_language: str = "en"
    quality: str = "best"


class DownloadCreate(BaseModel):
    url: str
    options: Optional[DownloadOptions] = DownloadOptions()


class DownloadResponse(BaseModel):
    id: int
    url: str
    status: DownloadStatus
    progress: float
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    video: Optional[VideoResponse] = None
    
    class Config:
        from_attributes = True


# Channel Schemas
class ChannelBase(BaseModel):
    name: str
    url: str
    platform: PlatformType


class ChannelCreate(ChannelBase):
    pass


class ChannelResponse(ChannelBase):
    id: int
    channel_id: Optional[str] = None
    avatar_url: Optional[str] = None
    subscribers: Optional[str] = None
    description: Optional[str] = None
    last_sync: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChannelScanResult(BaseModel):
    channel: ChannelResponse
    videos: List[VideoResponse]
    total_videos: int


# Account Schemas
class AccountBase(BaseModel):
    platform: PlatformType
    username: str
    profile_url: Optional[str] = None
    credentials: Optional[Dict[str, str]] = None


class AccountCreate(AccountBase):
    pass


class AccountResponse(AccountBase):
    id: int
    avatar_url: Optional[str] = None
    subscribers: Optional[str] = None
    is_active: bool = True
    last_sync: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Subtitle Schemas
class SubtitleBase(BaseModel):
    language: str
    format: str = "srt"


class SubtitleCreate(SubtitleBase):
    video_id: Optional[int] = None





class SubtitleResponse(SubtitleBase):
    id: int
    file_path: str
    is_burned: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


# Workflow Schemas
class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    workflow_data: Dict[str, Any]


class WorkflowCreate(WorkflowBase):
    is_active: bool = True
    schedule: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    workflow_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    schedule: Optional[str] = None


class WorkflowResponse(WorkflowBase):
    id: int
    is_active: bool
    schedule: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class WorkflowExecutionResponse(BaseModel):
    id: int
    workflow_id: int
    status: WorkflowStatus
    execution_log: Optional[Any] = None
    execution_results: Optional[Any] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Dashboard Schemas
class DashboardStats(BaseModel):
    total_downloads: int
    storage_used_gb: float
    storage_total_gb: float
    active_tasks: int
    total_videos: int
    total_channels: int


class ActivityItem(BaseModel):
    id: int
    title: str
    platform: str
    status: str
    time: str
    size: str
    progress: Optional[float] = None
    error: Optional[str] = None


class StorageStats(BaseModel):
    total_gb: float
    used_gb: float
    free_gb: float
    usage_percentage: float
    videos_count: int
    subtitles_count: int


# Bulk Operations
class BulkDownloadRequest(BaseModel):
    video_urls: List[str]
    options: Optional[DownloadOptions] = DownloadOptions()


class BulkDownloadResponse(BaseModel):
    total: int
    started: int
    download_ids: List[int]


# WebSocket Messages
class ProgressUpdate(BaseModel):
    download_id: int
    status: DownloadStatus
    progress: float
    message: Optional[str] = None


# Watermark Schemas
class WatermarkConfig(BaseModel):
    text: str
    position: str = "bottom-right"  # top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right
    font_size: int = 24
    color: str = "white"
    opacity: float = 0.8
    enable_box: bool = True
    box_color: str = "black"
    box_opacity: float = 0.5
    custom_x: Optional[int] = None
    custom_y: Optional[int] = None


class WatermarkApplyRequest(BaseModel):
    video_id: int
    config: WatermarkConfig


class WatermarkApplyResponse(BaseModel):
    success: bool
    output_path: Optional[str] = None
    error_message: Optional[str] = None


class WatermarkPreviewRequest(BaseModel):
    video_id: int
    config: WatermarkConfig
    timestamp: str = "00:00:01"


class WatermarkPreviewResponse(BaseModel):
    success: bool
    preview_url: Optional[str] = None
    error_message: Optional[str] = None
