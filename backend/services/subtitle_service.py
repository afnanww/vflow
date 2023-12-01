"""
Subtitle service for translation and burning
"""
import os
import logging
from typing import Optional


from backend.config import settings

logger = logging.getLogger(__name__)


class SubtitleService:
    """Service for subtitle processing"""
    
    def __init__(self):
        self.subtitles_path = os.path.join(settings.STORAGE_PATH, "subtitles")
        os.makedirs(self.subtitles_path, exist_ok=True)
    
    def parse_srt(self, file_path: str) -> list:
        """
        Parse SRT subtitle file
        
        Args:
            file_path: Path to SRT file
            
        Returns:
            List of subtitle entries
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Split by double newline
            blocks = content.strip().split('\n\n')
            
            subtitles = []
            for block in blocks:
                lines = block.strip().split('\n')
                if len(lines) >= 3:
                    index = lines[0]
                    timestamp = lines[1]
                    text = '\n'.join(lines[2:])
                    
                    subtitles.append({
                        'index': index,
                        'timestamp': timestamp,
                        'text': text
                    })
            
            return subtitles
        
        except Exception as e:
            logger.error(f"Error parsing SRT file: {e}")
            return []
    
    def generate_srt(self, subtitles: list, output_path: str) -> bool:
        """
        Generate SRT file from subtitle entries
        
        Args:
            subtitles: List of subtitle entries
            output_path: Output file path
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                for sub in subtitles:
                    f.write(f"{sub['index']}\n")
                    f.write(f"{sub['timestamp']}\n")
                    f.write(f"{sub['text']}\n\n")
            
            return True
        
        except Exception as e:
            logger.error(f"Error generating SRT file: {e}")
            return False
    

    
    def burn_subtitles(self, video_path: str, subtitle_path: Optional[str], output_path: str, watermark_text: Optional[str] = None) -> bool:
        """
        Burn subtitles and/or watermark into video using FFmpeg
        
        Args:
            video_path: Input video file path
            subtitle_path: Subtitle file path (optional)
            output_path: Output video file path
            watermark_text: Optional text to burn as watermark
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import ffmpeg
            
            # Build filter complex
            filters = []
            
            # Add subtitle filter if subtitle path is provided
            if subtitle_path:
                # Escape subtitle path for FFmpeg
                subtitle_path_escaped = subtitle_path.replace('\\', '/').replace(':', '\\:')
                filters.append(f"subtitles={subtitle_path_escaped}")
            
            # Add watermark filter if watermark text is provided
            if watermark_text:
                # Escape watermark text
                text = watermark_text.replace("'", "").replace(":", "")
                # Add drawtext filter for watermark (top left)
                filters.append(f"drawtext=text='{text}':x=10:y=10:fontsize=24:fontcolor=white@0.8:box=1:boxcolor=black@0.5:boxborderw=5")
            
            # If no filters, just copy the video
            if not filters:
                logger.warning("No subtitles or watermark provided for burn operation")
                return False
            
            # Combine filters
            vf_string = ",".join(filters)
            
            # Build FFmpeg command
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(
                stream,
                output_path,
                vf=vf_string,
                **{'c:a': 'copy'}  # Copy audio without re-encoding
            )
            
            # Run FFmpeg
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            return True
        
        except Exception as e:
            logger.error(f"Error burning subtitles/watermark: {e}")
            return False


# Global subtitle service instance
subtitle_service = SubtitleService()
