from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base
import enum


class PlatformType(str, enum.Enum):
    """Supported video platforms"""
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    DOUYIN = "douyin"


class DownloadStatus(str, enum.Enum):
    """Download task status"""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowStatus(str, enum.Enum):
    """Workflow execution status"""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Video(Base):
    """Downloaded video records"""
    __tablename__ = "videos"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False, unique=True)
    platform = Column(SQLEnum(PlatformType, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    thumbnail_url = Column(String(1000))
    duration = Column(Integer)  # in seconds
    file_path = Column(String(1000))
    file_size = Column(Integer)  # in bytes
    views = Column(String(50))
    upload_date = Column(String(50))
    description = Column(Text)
    has_subtitles = Column(Boolean, default=False)
    watermark_removed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True)
    channel = relationship("Channel", back_populates="videos")
    downloads = relationship("Download", back_populates="video")
    subtitles = relationship("Subtitle", back_populates="video")


class Channel(Base):
    """Tracked channels"""
    __tablename__ = "channels"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(1000), nullable=False, unique=True)
    platform = Column(SQLEnum(PlatformType, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    channel_id = Column(String(200))  # Platform-specific ID
    avatar_url = Column(String(1000))
    subscribers = Column(String(50))
    description = Column(Text)
    last_sync = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    account = relationship("Account", back_populates="channels")
    videos = relationship("Video", back_populates="channel")


class Account(Base):
    """Linked user accounts for different platforms"""
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(SQLEnum(PlatformType, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    username = Column(String(200), nullable=False)
    profile_url = Column(String(1000))
    avatar_url = Column(String(1000))
    subscribers = Column(String(50))
    credentials = Column(JSON)  # Store API keys/secrets
    access_token = Column(String(500))  # For OAuth if needed
    refresh_token = Column(String(500))
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    channels = relationship("Channel", back_populates="account")


class Download(Base):
    """Download tasks with progress tracking"""
    __tablename__ = "downloads"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(1000), nullable=False)
    status = Column(SQLEnum(DownloadStatus, values_callable=lambda obj: [e.value for e in obj]), default=DownloadStatus.PENDING)
    progress = Column(Float, default=0.0)  # 0-100
    error_message = Column(Text)
    download_options = Column(JSON)  # Store options like quality, subtitles, etc.
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    video = relationship("Video", back_populates="downloads")


class Subtitle(Base):
    """Subtitle files and translations"""
    __tablename__ = "subtitles"
    
    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String(1000), nullable=False)
    language = Column(String(10), nullable=False)  # ISO language code
    format = Column(String(10))  # srt, vtt, etc.
    is_translated = Column(Boolean, default=False)
    source_language = Column(String(10))
    is_burned = Column(Boolean, default=False)  # Burned into video
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    video = relationship("Video", back_populates="subtitles")


class Workflow(Base):
    """Automation workflows"""
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    workflow_data = Column(JSON, nullable=False)  # Workflow definition (nodes, connections)
    is_active = Column(Boolean, default=True)
    schedule = Column(String(100))  # Cron expression for scheduled execution
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    executions = relationship("WorkflowExecution", back_populates="workflow")


class WorkflowExecution(Base):
    """Workflow execution history"""
    __tablename__ = "workflow_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(SQLEnum(WorkflowStatus, values_callable=lambda obj: [e.value for e in obj]), default=WorkflowStatus.RUNNING)
    execution_log = Column(JSON)  # Detailed execution log
    execution_results = Column(JSON)  # Results: videos downloaded, files created, etc.
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    workflow = relationship("Workflow", back_populates="executions")
