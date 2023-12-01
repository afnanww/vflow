"""
Scanner service for extracting video and channel information using yt-dlp
"""
import yt_dlp
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from backend.config import settings
from backend.utils.platform_detector import detect_platform

logger = logging.getLogger(__name__)

class ScannerService:
    """Service for scanning channels and extracting video information"""
    
    def get_video_info(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Extract video information without downloading
        
        Args:
            url: Video URL
            
        Returns:
            Video information dictionary or None
        """
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                return {
                    'title': info.get('title'),
                    'url': url,
                    'thumbnail_url': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'views': str(info.get('view_count', 0)),
                    'upload_date': info.get('upload_date'),
                    'description': info.get('description'),
                    'uploader': info.get('uploader'),
                    'channel_id': info.get('channel_id'),
                    'channel_url': info.get('channel_url'),
                }
        except Exception as e:
            logger.error(f"Error extracting video info: {e}")
            return None

    def scan_channel(self, channel_url: str, max_videos: Optional[int] = 50) -> Optional[Dict[str, Any]]:
        """
        Scan a channel and get video list
        
        Args:
            channel_url: Channel URL
            max_videos: Maximum number of videos to retrieve (None for all)
            
        Returns:
            Channel info and video list or None
        """
        try:
            logger.info(f"Scanning channel: {channel_url}")
            
            # For YouTube channels, we need to append /videos to get the videos tab
            # This gives us actual videos instead of playlists
            videos_url = channel_url
            if 'youtube.com/@' in channel_url or 'youtube.com/c/' in channel_url or 'youtube.com/channel/' in channel_url:
                if not channel_url.endswith('/videos'):
                    videos_url = channel_url.rstrip('/') + '/videos'
            
            logger.info(f"Fetching videos from: {videos_url}")
            
            # Use extract_flat=False to get full video metadata
            # This is slower but gives us all the information we need
            ydl_opts = {
                'quiet': False,
                'no_warnings': False,
                'extract_flat': False,  # Get full video info
                'ignoreerrors': True,  # Continue on errors
            }
            
            if max_videos:
                ydl_opts['playlistend'] = max_videos
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(videos_url, download=False)
                
                if not info:
                    logger.error("No information returned from yt-dlp")
                    return None
                
                videos = []
                entries = info.get('entries', [])
                
                logger.info(f"Found {len(entries)} video entries from channel")
                
                for entry in entries:
                    if not entry:
                        continue
                    
                    try:
                        # Get video ID and construct proper URL
                        video_id = entry.get('id')
                        video_url = entry.get('webpage_url') or entry.get('url')
                        
                        # If we only have ID, construct the URL based on platform
                        if not video_url and video_id:
                            # Detect platform from channel URL
                            if 'youtube.com' in channel_url or 'youtu.be' in channel_url:
                                video_url = f"https://www.youtube.com/watch?v={video_id}"
                            elif 'tiktok.com' in channel_url:
                                # Try to get uploader name from entry or use 'user' as fallback
                                # TikTok URLs are typically tiktok.com/@username/video/id
                                uploader = entry.get('uploader') or 'user'
                                # Ensure uploader starts with @
                                if not uploader.startswith('@'):
                                    uploader = f"@{uploader}"
                                video_url = f"https://www.tiktok.com/{uploader}/video/{video_id}"
                            elif 'douyin.com' in channel_url:
                                video_url = f"https://www.douyin.com/video/{video_id}"
                            else:
                                # Fallback: use the ID as-is
                                video_url = video_id
                        
                        # Format duration as MM:SS
                        duration = entry.get('duration')
                        duration_str = None
                        if duration:
                            minutes = int(duration // 60)
                            seconds = int(duration % 60)
                            duration_str = f"{minutes}:{seconds:02d}"
                        
                        # Format upload date
                        upload_date = entry.get('upload_date')
                        upload_date_str = None
                        if upload_date:
                            try:
                                from datetime import datetime
                                date_obj = datetime.strptime(str(upload_date), '%Y%m%d')
                                upload_date_str = date_obj.strftime('%b %d, %Y')
                            except:
                                upload_date_str = str(upload_date)
                        
                        # Get view count
                        view_count = entry.get('view_count', 0)
                        views_str = f"{view_count:,}" if view_count else "0"
                        
                        # Get thumbnail - try multiple fields
                        thumbnail = entry.get('thumbnail')
                        if not thumbnail and entry.get('thumbnails'):
                            # Get the highest quality thumbnail
                            thumbnails = entry.get('thumbnails', [])
                            if thumbnails:
                                thumbnail = thumbnails[-1].get('url')
                        
                        video_data = {
                            'id': video_id,
                            'title': entry.get('title', 'Unknown Title'),
                            'url': video_url,
                            'thumbnail_url': thumbnail,
                            'duration': duration,
                            'duration_string': duration_str,
                            'views': views_str,
                            'view_count': view_count,
                            'upload_date': upload_date_str,
                        }
                        
                        videos.append(video_data)
                        logger.debug(f"Added video: {video_data['title']}")
                    
                    except Exception as e:
                        logger.warning(f"Error processing video entry: {e}")
                        continue
                
                # Get channel info from the playlist info
                channel_name = info.get('channel') or info.get('uploader') or info.get('title')
                
                logger.info(f"Successfully scanned channel '{channel_name}' with {len(videos)} videos")
                
                return {
                    'channel_name': channel_name,
                    'channel_id': info.get('channel_id') or info.get('uploader_id'),
                    'channel_url': channel_url,  # Return original URL, not /videos
                    'description': info.get('description'),
                    'subscriber_count': str(info.get('channel_follower_count', 0)),
                    'videos': videos,
                    'total_videos': len(videos)
                }
        
        except Exception as e:
            logger.error(f"Error scanning channel: {e}", exc_info=True)
            return None

# Global scanner instance
scanner = ScannerService()
