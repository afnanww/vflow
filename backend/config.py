from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:1@localhost:5432/video_downloader"
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "video_downloader"
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "1"
    
    # Application
    APP_NAME: str = "Video Downloader API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:5174"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # File Storage
    STORAGE_PATH: str = "./storage"
    MAX_STORAGE_GB: int = 100
    
    # Download Settings
    MAX_CONCURRENT_DOWNLOADS: int = 3
    DEFAULT_VIDEO_QUALITY: str = "best"
    
    # Translation
    GOOGLE_TRANSLATE_API_KEY: str = ""
    
    # FFmpeg
    FFMPEG_PATH: str = ""

    # OAuth Credentials
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REDIRECT_URI: str = "http://localhost:5173/auth/callback/youtube"
    
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    TIKTOK_REDIRECT_URI: str = "http://localhost:5173/auth/callback/tiktok"
    
    DOUYIN_CLIENT_KEY: str = ""
    DOUYIN_CLIENT_SECRET: str = ""
    DOUYIN_REDIRECT_URI: str = "http://localhost:5173/auth/callback/douyin"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
