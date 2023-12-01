"""
WebSocket-based progress tracking for downloads
"""
import asyncio
import logging
from typing import Dict, Set
from fastapi import WebSocket
import json

logger = logging.getLogger(__name__)


class ProgressTracker:
    """Manages WebSocket connections for real-time progress updates"""
    
    def __init__(self):
        # Store active WebSocket connections
        self.active_connections: Set[WebSocket] = set()
        # Store download progress
        self.download_progress: Dict[int, Dict] = {}
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_progress(self, download_id: int, progress: float, status: str, message: str = ""):
        """
        Send progress update to all connected clients
        
        Args:
            download_id: Download task ID
            progress: Progress percentage (0-100)
            status: Download status
            message: Optional status message
        """
        # Update stored progress
        self.download_progress[download_id] = {
            'download_id': download_id,
            'progress': progress,
            'status': status,
            'message': message
        }
        
        # Broadcast to all connected clients
        data = json.dumps(self.download_progress[download_id])
        
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception as e:
                logger.error(f"Error sending progress update: {e}")
                disconnected.add(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    def get_progress(self, download_id: int) -> Dict:
        """Get current progress for a download"""
        return self.download_progress.get(download_id, {
            'download_id': download_id,
            'progress': 0,
            'status': 'unknown',
            'message': ''
        })
    
    def clear_progress(self, download_id: int):
        """Clear progress data for a download"""
        if download_id in self.download_progress:
            del self.download_progress[download_id]


# Global progress tracker instance
progress_tracker = ProgressTracker()
