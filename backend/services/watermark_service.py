"""
Watermark service for applying watermarks to videos
"""
import os
import logging
from typing import Optional, Dict, Any
import subprocess

from backend.config import settings

logger = logging.getLogger(__name__)


class WatermarkService:
    """Service for watermark operations"""
    
    def __init__(self):
        self.watermarks_path = os.path.join(settings.STORAGE_PATH, "watermarks")
        os.makedirs(self.watermarks_path, exist_ok=True)
    
    def apply_watermark(
        self,
        video_path: str,
        output_path: str,
        text: str,
        position: str = "bottom-right",
        font_size: int = 24,
        color: str = "white",
        opacity: float = 0.8,
        enable_box: bool = True,
        box_color: str = "black",
        box_opacity: float = 0.5,
        custom_x: Optional[int] = None,
        custom_y: Optional[int] = None
    ) -> bool:
        """
        Apply watermark to a video using FFmpeg
        
        Args:
            video_path: Input video file path
            output_path: Output video file path
            text: Watermark text
            position: Preset position (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)
            font_size: Font size in pixels
            color: Text color (name or hex)
            opacity: Text opacity (0.0-1.0)
            enable_box: Whether to show background box
            box_color: Background box color
            box_opacity: Background box opacity (0.0-1.0)
            custom_x: Custom X position (overrides position preset)
            custom_y: Custom Y position (overrides position preset)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import ffmpeg
            
            # Escape text for FFmpeg
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Calculate position
            if custom_x is not None and custom_y is not None:
                x_pos = str(custom_x)
                y_pos = str(custom_y)
            else:
                x_pos, y_pos = self._get_position_coordinates(position)
            
            # Build drawtext filter
            fontcolor = f"{color}@{opacity}"
            
            drawtext_params = [
                f"text='{escaped_text}'",
                f"x={x_pos}",
                f"y={y_pos}",
                f"fontsize={font_size}",
                f"fontcolor={fontcolor}"
            ]
            
            # Add box if enabled
            if enable_box:
                boxcolor = f"{box_color}@{box_opacity}"
                drawtext_params.extend([
                    "box=1",
                    f"boxcolor={boxcolor}",
                    "boxborderw=5"
                ])
            
            vf_string = "drawtext=" + ":".join(drawtext_params)
            
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
            
            logger.info(f"Watermark applied successfully: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error applying watermark: {e}")
            return False
    
    def _get_position_coordinates(self, position: str) -> tuple:
        """
        Get x, y coordinates for preset positions
        
        Args:
            position: Preset position name
            
        Returns:
            Tuple of (x, y) as strings (can include expressions)
        """
        positions = {
            "top-left": ("10", "10"),
            "top-center": ("(w-text_w)/2", "10"),
            "top-right": ("w-text_w-10", "10"),
            "center-left": ("10", "(h-text_h)/2"),
            "center": ("(w-text_w)/2", "(h-text_h)/2"),
            "center-right": ("w-text_w-10", "(h-text_h)/2"),
            "bottom-left": ("10", "h-text_h-10"),
            "bottom-center": ("(w-text_w)/2", "h-text_h-10"),
            "bottom-right": ("w-text_w-10", "h-text_h-10")
        }
        
        return positions.get(position, positions["bottom-right"])
    
    def generate_preview_frame(
        self,
        video_path: str,
        output_path: str,
        text: str,
        position: str = "bottom-right",
        font_size: int = 24,
        color: str = "white",
        opacity: float = 0.8,
        enable_box: bool = True,
        box_color: str = "black",
        box_opacity: float = 0.5,
        custom_x: Optional[int] = None,
        custom_y: Optional[int] = None,
        timestamp: str = "00:00:01"
    ) -> bool:
        """
        Generate a preview frame with watermark
        
        Args:
            video_path: Input video file path
            output_path: Output image file path
            text: Watermark text
            position: Preset position
            font_size: Font size in pixels
            color: Text color
            opacity: Text opacity
            enable_box: Whether to show background box
            box_color: Background box color
            box_opacity: Background box opacity
            custom_x: Custom X position
            custom_y: Custom Y position
            timestamp: Timestamp to extract frame from (HH:MM:SS)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import ffmpeg
            
            # Escape text for FFmpeg
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Calculate position
            if custom_x is not None and custom_y is not None:
                x_pos = str(custom_x)
                y_pos = str(custom_y)
            else:
                x_pos, y_pos = self._get_position_coordinates(position)
            
            # Build drawtext filter
            fontcolor = f"{color}@{opacity}"
            
            drawtext_params = [
                f"text='{escaped_text}'",
                f"x={x_pos}",
                f"y={y_pos}",
                f"fontsize={font_size}",
                f"fontcolor={fontcolor}"
            ]
            
            # Add box if enabled
            if enable_box:
                boxcolor = f"{box_color}@{box_opacity}"
                drawtext_params.extend([
                    "box=1",
                    f"boxcolor={boxcolor}",
                    "boxborderw=5"
                ])
            
            vf_string = "drawtext=" + ":".join(drawtext_params)
            
            # Extract frame at timestamp with watermark
            stream = ffmpeg.input(video_path, ss=timestamp)
            stream = ffmpeg.output(
                stream,
                output_path,
                vf=vf_string,
                vframes=1
            )
            
            # Run FFmpeg
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            logger.info(f"Preview frame generated: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error generating preview frame: {e}")
            return False


# Global watermark service instance
watermark_service = WatermarkService()
