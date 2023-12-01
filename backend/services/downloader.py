"""
Video download service using yt-dlp
"""
import yt_dlp
import os
import logging
from typing import Dict, Any, Optional, List, Callable, Union
from datetime import datetime
import re

from backend.config import settings

logger = logging.getLogger(__name__)


class DownloadProgressHook:
    """Hook for tracking download progress"""
    
    def __init__(self, callback: Optional[Callable] = None):
        self.callback = callback
        self.last_progress = 0.0
    
    def __call__(self, d: Dict[str, Any]):
        """Called by yt-dlp during download"""
        if d['status'] == 'downloading':
            # Calculate progress percentage
            progress = 0.0
            if 'total_bytes' in d and d['total_bytes'] > 0:
                progress = (d.get('downloaded_bytes', 0) / d['total_bytes']) * 100
            elif 'total_bytes_estimate' in d and d['total_bytes_estimate'] > 0:
                progress = (d.get('downloaded_bytes', 0) / d['total_bytes_estimate']) * 100
            
            # Only call callback if progress changed significantly (e.g., > 0.5%) or completed
            if abs(progress - self.last_progress) >= 0.5 or progress >= 100:
                self.last_progress = progress
                if self.callback:
                    self.callback(progress, 'downloading')
        
        elif d['status'] == 'finished':
            if self.callback:
                self.callback(100.0, 'processing')


class VideoDownloader:
    """Service for downloading videos using yt-dlp"""
    
    def __init__(self):
        self.storage_path = settings.STORAGE_PATH
        self.videos_path = os.path.join(self.storage_path, "videos")
        self.subtitles_path = os.path.join(self.storage_path, "subtitles")
        
        # Ensure directories exist
        os.makedirs(self.videos_path, exist_ok=True)
        os.makedirs(self.subtitles_path, exist_ok=True)
    
    def get_ydl_opts(
        self,
        output_path: str,
        download_subtitles: bool = False,
        subtitle_lang: str = 'en',
        quality: str = 'best',
        progress_hook: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Get yt-dlp options
        
        Args:
            output_path: Output file path template
            download_subtitles: Whether to download subtitles
            subtitle_lang: Subtitle language code
            quality: Video quality
            progress_hook: Progress callback function
            
        Returns:
            yt-dlp options dictionary
        """
        # Map simple quality strings to yt-dlp format strings
        format_str = quality
        if quality == 'best':
            format_str = 'bestvideo+bestaudio/best'
        elif quality == 'worst':
            format_str = 'worstvideo+worstaudio/worst'
        
        opts = {
            'format': format_str,
            'outtmpl': output_path,
            'quiet': False,
            'no_warnings': False,
            'extract_flat': False,
            'writethumbnail': True,
            'writesubtitles': download_subtitles,
            'writeautomaticsub': download_subtitles,
            'subtitleslangs': [subtitle_lang] if download_subtitles else [],
            'subtitlesformat': 'srt',
            # Post-processors to ensure mp4 format and embed metadata
            'postprocessors': [
                {
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                },
                {
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                }
            ],
            # Network options to avoid getting blocked
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        }
        
        if progress_hook:
            opts['progress_hooks'] = [DownloadProgressHook(progress_hook)]
        
        return opts
    
    def _sanitize_filename(self, title: str) -> str:
        """Sanitize title for use as filename"""
        # Remove invalid characters
        safe_title = re.sub(r'[\\/*?:"<>|]', '', title)
        # Replace spaces with underscores or hyphens if preferred, or just keep spaces
        # Here we keep spaces but strip leading/trailing
        return safe_title.strip()

    def download_video(
        self,
        url: str,
        download_subtitles: bool = False,
        subtitle_lang: str = 'en',
        quality: str = 'best',
        progress_callback: Optional[Callable] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Download a single video
        
        Args:
            url: Video URL
            download_subtitles: Whether to download subtitles
            subtitle_lang: Subtitle language
            quality: Video quality
            progress_callback: Progress callback function
            
        Returns:
            Download result with file paths or None on error
        """
        try:
            logger.info(f"Starting download for: {url}")
            
            # 1. Extract basic info first to get title for filename
            # We use a separate lightweight extraction here
            title = "video"
            try:
                with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True}) as ydl:
                    info = ydl.extract_info(url, download=False)
                    if info:
                        title = info.get('title', 'video')
            except Exception as e:
                logger.warning(f"Could not extract title before download: {e}")
            
            # 2. Generate output path
            safe_title = self._sanitize_filename(title)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            # Limit title length to avoid filesystem errors
            if len(safe_title) > 100:
                safe_title = safe_title[:100]
                
            output_template = os.path.join(self.videos_path, f"{safe_title}_{timestamp}.%(ext)s")
            
            # 3. Configure options
            ydl_opts = self.get_ydl_opts(
                output_template,
                download_subtitles,
                subtitle_lang,
                quality,
                progress_callback
            )
            
            # 4. Execute download
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(url, download=True)
                
                if not result:
                    logger.error("Download returned no result")
                    return None
                
                # Get the actual downloaded file path
                # prepare_filename returns the template with values filled, but extension might differ
                # after post-processing (e.g. mkv -> mp4).
                # However, since we enforce mp4 conversion, we can predict it.
                
                # Best way is to look for the file that matches the pattern
                expected_filename_base = output_template.replace('.%(ext)s', '')
                # Fill in the title if it was part of the template (it wasn't, we hardcoded it)
                
                # Actually, ydl.prepare_filename(result) gives the filename BEFORE conversion
                # So if it downloaded .webm, it returns .webm. But we converted to .mp4.
                
                # Let's find the file
                video_file = None
                base_path_no_ext = os.path.join(self.videos_path, f"{safe_title}_{timestamp}")
                
                # Check for mp4 first
                if os.path.exists(f"{base_path_no_ext}.mp4"):
                    video_file = f"{base_path_no_ext}.mp4"
                # Then check whatever prepare_filename says, just in case conversion failed or wasn't needed
                elif os.path.exists(ydl.prepare_filename(result)):
                    video_file = ydl.prepare_filename(result)
                
                if not video_file:
                    # Fallback search
                    for file in os.listdir(self.videos_path):
                        if file.startswith(f"{safe_title}_{timestamp}"):
                            video_file = os.path.join(self.videos_path, file)
                            break
                
                if not video_file:
                    logger.error("Could not locate downloaded file")
                    return None
                
                # Check for subtitle files
                subtitle_files = []
                if download_subtitles:
                    base_path = os.path.splitext(video_file)[0]
                    # yt-dlp names subs as filename.lang.srt
                    for ext in ['.srt', '.vtt']:
                        sub_file = f"{base_path}.{subtitle_lang}{ext}"
                        if os.path.exists(sub_file):
                            subtitle_files.append(sub_file)
                
                # Construct info dict
                info_dict = {
                    'title': result.get('title'),
                    'url': url,
                    'thumbnail_url': result.get('thumbnail'),
                    'duration': result.get('duration'),
                    'views': str(result.get('view_count', 0)),
                    'upload_date': result.get('upload_date'),
                    'description': result.get('description'),
                    'uploader': result.get('uploader'),
                    'channel_id': result.get('channel_id'),
                    'channel_url': result.get('channel_url'),
                }

                return {
                    'video_file': video_file,
                    'subtitle_files': subtitle_files,
                    'info': info_dict,
                    'file_size': os.path.getsize(video_file) if os.path.exists(video_file) else 0
                }
        
        except Exception as e:
            logger.error(f"Error downloading video: {e}", exc_info=True)
            return None


# Global downloader instance
downloader = VideoDownloader()
