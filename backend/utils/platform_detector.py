"""
Utility module for detecting video platform from URL
"""
import re
from typing import Optional
from backend.models import PlatformType


def detect_platform(url: str) -> Optional[PlatformType]:
    """
    Detect the platform from a video URL
    
    Args:
        url: Video or channel URL
        
    Returns:
        PlatformType or None if platform cannot be detected
    """
    url = url.lower().strip()
    
    # YouTube patterns
    youtube_patterns = [
        r'youtube\.com',
        r'youtu\.be',
        r'youtube-nocookie\.com'
    ]
    
    # TikTok patterns
    tiktok_patterns = [
        r'tiktok\.com',
        r'vm\.tiktok\.com',
        r'vt\.tiktok\.com'
    ]
    
    # Douyin patterns
    douyin_patterns = [
        r'douyin\.com',
        r'iesdouyin\.com'
    ]
    
    for pattern in youtube_patterns:
        if re.search(pattern, url):
            return PlatformType.YOUTUBE
    
    for pattern in tiktok_patterns:
        if re.search(pattern, url):
            return PlatformType.TIKTOK
    
    for pattern in douyin_patterns:
        if re.search(pattern, url):
            return PlatformType.DOUYIN
    
    return None


def is_channel_url(url: str) -> bool:
    """
    Check if URL is a channel URL (vs single video)
    
    Args:
        url: URL to check
        
    Returns:
        True if channel URL, False otherwise
    """
    url = url.lower()
    
    # YouTube channel indicators
    youtube_channel_patterns = [
        r'/channel/',
        r'/c/',
        r'/user/',
        r'/@[\w-]+(?:/?\?.*)?$'
    ]
    
    # TikTok user profile
    tiktok_user_patterns = [
        r'/@[\w.-]+(?:/?\?.*)?$',
        r'/user/'
    ]
    
    # Douyin user profile
    douyin_user_patterns = [
        r'/user/'
    ]
    
    all_patterns = youtube_channel_patterns + tiktok_user_patterns + douyin_user_patterns
    
    for pattern in all_patterns:
        if re.search(pattern, url):
            return True
    
    return False


def extract_video_id(url: str, platform: PlatformType) -> Optional[str]:
    """
    Extract video ID from URL
    
    Args:
        url: Video URL
        platform: Platform type
        
    Returns:
        Video ID or None
    """
    if platform == PlatformType.YOUTUBE:
        # Match various YouTube URL formats
        patterns = [
            r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
            r'(?:embed/)([0-9A-Za-z_-]{11})',
            r'(?:watch\?v=)([0-9A-Za-z_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
    
    elif platform == PlatformType.TIKTOK:
        # TikTok video ID
        match = re.search(r'/video/(\d+)', url)
        if match:
            return match.group(1)
    
    elif platform == PlatformType.DOUYIN:
        # Douyin video ID
        match = re.search(r'/video/(\d+)', url)
        if match:
            return match.group(1)
    
    return None
