"""
Workflow execution service
"""
import logging
import asyncio
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from backend.models import Workflow, WorkflowExecution, WorkflowStatus, Video, Subtitle
from backend.services.downloader import downloader
from backend.services.scanner_service import scanner
from backend.services.subtitle_service import subtitle_service
from backend.services.upload_service import upload_service
import os
from backend.database import SessionLocal

from backend.websocket_manager import manager

logger = logging.getLogger(__name__)

# Create a dedicated thread pool for workflow operations to avoid blocking the main loop
# or starving other operations
workflow_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="workflow_worker")

class WorkflowService:
    """Service for executing workflows"""
    
    def __init__(self):
        pass
        
    async def execute_workflow(self, workflow_id: int, execution_id: int):
        """
        Execute a workflow by ID - Sequential per-video processing
        
        Args:
            workflow_id: ID of the workflow to execute
            execution_id: ID of the execution record
        """
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
            
            if not workflow or not execution:
                logger.error(f"Workflow {workflow_id} or Execution {execution_id} not found")
                return
            
            # Parse workflow data
            nodes = workflow.workflow_data.get('nodes', [])
            edges = workflow.workflow_data.get('edges', [])
            
            # Build execution graph
            incoming_edges = {node['id']: [] for node in nodes}
            outgoing_edges = {node['id']: [] for node in nodes}
            
            for edge in edges:
                incoming_edges[edge['target']].append(edge['source'])
                outgoing_edges[edge['source']].append(edge['target'])
            
            # Find the scan node (should be the start node)
            scan_node = next((n for n in nodes if n['type'] == 'scan'), None)
            
            # Context to pass data between nodes
            context = {
                "videos": [],           # List of video dicts from scan
                "downloaded_files": [], # List of local file paths
                "subtitles": [],        # List of subtitle file paths
                "logs": [],
                "processed_count": 0,   # Track processed videos
            }
            
            def update_execution_state():
                execution.execution_log = list(context["logs"])
                execution.execution_results = {
                    "videos_count": len(context.get("downloaded_files", [])),
                    "downloaded_files": context.get("downloaded_files", []),
                    "subtitles": context.get("subtitles", []),
                    "scanned_videos_count": len(context.get("videos", [])),
                    "scanned_videos": context.get("video_progress", []),
                    "processed_count": context.get("processed_count", 0)
                }
                db.commit()
            
            execution.status = WorkflowStatus.RUNNING
            db.commit()
            
            # Step 1: Execute scan node if exists
            if scan_node:
                await self._execute_single_node(scan_node, context, execution)
                update_execution_state()
            
            # Step 2: Process each video sequentially through the pipeline
            videos = context.get('videos', [])
            if videos and scan_node:
                await self._log(context, f"Processing {len(videos)} videos sequentially through pipeline...")
                
                # Initialize video progress tracking
                context["video_progress"] = []
                for video in videos:
                    context["video_progress"].append({
                        "video_id": video.get('id'),
                        "title": video.get('title'),
                        "thumbnail_url": video.get('thumbnail_url'),
                        "status": "pending",
                        "current_stage": None,
                        "stages": {
                            "download": "pending",
                            "burn": "pending",
                            "upload": "pending"
                        }
                    })
                
                # Broadcast initial video list
                await self._broadcast_event("videos_scanned", {
                    "execution_id": execution.id,
                    "videos": context["video_progress"],
                    "total": len(videos)
                })
                
                # Get the pipeline nodes (download, translate, burn, upload) in order
                pipeline_nodes = self._get_pipeline_nodes(scan_node, nodes, outgoing_edges)
                
                for idx, video in enumerate(videos, 1):
                    # Check for cancellation
                    check_db = SessionLocal()
                    try:
                        current_execution = check_db.query(WorkflowExecution).filter(WorkflowExecution.id == execution.id).first()
                        if current_execution and current_execution.status == WorkflowStatus.CANCELLED:
                            await self._log(context, "Workflow execution cancelled by user", level="warning")
                            break
                    finally:
                        check_db.close()
                    
                    # Update video status to processing
                    context["video_progress"][idx-1]["status"] = "processing"
                    await self._broadcast_event("video_started", {
                        "execution_id": execution.id,
                        "video_index": idx - 1,
                        "video_id": video.get('id'),
                        "title": video.get('title'),
                        "progress": f"{idx}/{len(videos)}"
                    })
                    
                    await self._log(context, f"[{idx}/{len(videos)}] Processing video: {video.get('title', 'Unknown')}")
                    
                    # Create a per-video context
                    video_context = {
                        "videos": [video],  # Single video
                        "downloaded_files": [],
                        "subtitles": [],
                        "logs": context["logs"],  # Share logs
                        "video_index": idx - 1,
                        "execution_id": execution.id,
                    }
                    
                    # Execute pipeline for this video
                    try:
                        for node in pipeline_nodes:
                            # Update current stage
                            stage_name = node['type']
                            context["video_progress"][idx-1]["current_stage"] = stage_name
                            context["video_progress"][idx-1]["stages"][stage_name] = "running"
                            
                            await self._broadcast_event("video_stage_update", {
                                "execution_id": execution.id,
                                "video_index": idx - 1,
                                "stage": stage_name,
                                "status": "running"
                            })
                            
                            await self._execute_single_node(node, video_context, execution)
                            
                            # Mark stage as completed
                            context["video_progress"][idx-1]["stages"][stage_name] = "completed"
                            await self._broadcast_event("video_stage_update", {
                                "execution_id": execution.id,
                                "video_index": idx - 1,
                                "stage": stage_name,
                                "status": "completed"
                            })
                        
                        # Mark video as completed
                        context["video_progress"][idx-1]["status"] = "completed"
                        context["video_progress"][idx-1]["current_stage"] = None
                        
                        await self._broadcast_event("video_completed", {
                            "execution_id": execution.id,
                            "video_index": idx - 1,
                            "video_id": video.get('id'),
                            "title": video.get('title')
                        })
                        
                    except Exception as e:
                        # Mark video as failed
                        context["video_progress"][idx-1]["status"] = "failed"
                        context["video_progress"][idx-1]["error"] = str(e)
                        
                        await self._broadcast_event("video_failed", {
                            "execution_id": execution.id,
                            "video_index": idx - 1,
                            "video_id": video.get('id'),
                            "title": video.get('title'),
                            "error": str(e)
                        })
                        
                        await self._log(context, f"[{idx}/{len(videos)}] Failed to process: {str(e)}", level="error")
                        continue
                    
                    # Merge results back to main context
                    context["downloaded_files"].extend(video_context.get("downloaded_files", []))
                    context["subtitles"].extend(video_context.get("subtitles", []))
                    context["processed_count"] += 1
                    update_execution_state()
                    
                    await self._log(context, f"[{idx}/{len(videos)}] Completed processing for: {video.get('title', 'Unknown')}")
            
            execution.status = WorkflowStatus.COMPLETED
            execution.completed_at = datetime.now()
            execution.execution_log = context["logs"]
            
            # Save execution results
            execution.execution_results = {
                "videos_count": len(context.get("downloaded_files", [])),
                "downloaded_files": context.get("downloaded_files", []),
                "subtitles": context.get("subtitles", []),
                "scanned_videos_count": len(context.get("videos", [])),
                "scanned_videos": context.get("video_progress", []),
                "processed_count": context.get("processed_count", 0)
            }
            db.commit()
            
            await self._broadcast_event("workflow_completed", {"execution_id": execution_id, "status": "COMPLETED"})
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            if execution:
                execution.status = WorkflowStatus.FAILED
                execution.error_message = str(e)
                execution.completed_at = datetime.now()
                db.commit()
            await self._broadcast_event("workflow_failed", {"execution_id": execution_id, "error": str(e)})
        finally:
            db.close()
    
    def _get_pipeline_nodes(self, scan_node: Dict[str, Any], all_nodes: List[Dict[str, Any]], outgoing_edges: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Get the pipeline nodes in order after scan node"""
        pipeline_nodes = []
        current_id = scan_node['id']
        
        # Follow the edges to get nodes in order
        while True:
            children = outgoing_edges.get(current_id, [])
            if not children:
                break
            
            # Get the first child (assuming linear pipeline)
            child_id = children[0]
            child_node = next((n for n in all_nodes if n['id'] == child_id), None)
            
            if child_node and child_node['type'] != 'scan':
                pipeline_nodes.append(child_node)
                current_id = child_id
            else:
                break
        
        return pipeline_nodes
    
    async def _execute_single_node(self, node: Dict[str, Any], context: Dict[str, Any], execution: WorkflowExecution):
        """Execute a single node without following children"""
        node_type = node['type']
        node_config = node['data'].get('config', {})
        
        await self._log(context, f"Executing node: {node['data']['label']} ({node_type})", node_id=node['id'])
        await self._broadcast_event("node_started", {"node_id": node['id'], "node_type": node_type})
        
        try:
            if node_type == 'scan':
                await self._handle_scan(node_config, context)
            elif node_type == 'download':
                await self._handle_download(node_config, context)

            elif node_type == 'burn':
                await self._handle_burn(node_config, context)
            elif node_type == 'upload':
                await self._handle_upload(node_config, context)
            
            await self._broadcast_event("node_completed", {"node_id": node['id'], "node_type": node_type})
                    
        except Exception as e:
            await self._log(context, f"Error in node {node['data']['label']}: {str(e)}", level="error")
            raise e

    async def _handle_scan(self, config: Dict[str, Any], context: Dict[str, Any]):
        """Handle Scan Channel node"""
        url = config.get('url')
        if not url:
            raise ValueError("No URL provided for scan")
            
        # Get video limit from config (default to None for all videos)
        video_limit = config.get('video_limit', 'all')
        limit = None if video_limit == 'all' else int(video_limit)
        
        await self._log(context, f"Scanning channel: {url} (Limit: {'all videos' if video_limit == 'all' else f'{limit} videos'})")
        
        # Run scan in executor since it's blocking
        loop = asyncio.get_running_loop()
        # Use the dedicated workflow executor
        result = await loop.run_in_executor(workflow_executor, scanner.scan_channel, url, limit)
        
        if result and result.get('videos'):
            context['videos'] = result['videos']
            await self._log(context, f"Found {len(result['videos'])} videos")
        else:
            await self._log(context, "No videos found")

    async def _handle_download(self, config: Dict[str, Any], context: Dict[str, Any]):
        """Handle Download Video node"""
        videos = context.get('videos', [])
        if not videos:
            await self._log(context, "No videos to download")
            return
        
        # Read config options
        download_subtitles = config.get('download_subtitles', True)  # Default to True
        subtitle_language = config.get('subtitle_language', 'en')
        quality = 'best'
        
        await self._log(context, f"Downloading {len(videos)} videos (Subtitles: {download_subtitles}, Lang: {subtitle_language})...")
        
        for video in videos:
            url = video['url']
            await self._log(context, f"Downloading: {video['title']}")
            
            # Run download in executor
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                workflow_executor, 
                downloader.download_video, 
                url, 
                download_subtitles,
                subtitle_language,
                quality
            )
            
            if result:
                context['downloaded_files'].append(result)
                await self._log(context, f"Downloaded: {result['video_file']}")
                if download_subtitles and result.get('subtitle_files'):
                    await self._log(context, f"Subtitles: {len(result['subtitle_files'])} file(s)")
            else:
                await self._log(context, f"Failed to download: {url}")



    async def _handle_burn(self, config: Dict[str, Any], context: Dict[str, Any]):
        """Handle Burn Subtitles node"""
        # Get watermark config
        add_watermark = config.get('add_watermark', False)
        watermark_text = config.get('watermark_text', '').strip() if add_watermark else None
        
        downloaded_items = context.get('downloaded_files', [])
        for item in downloaded_items:
            video_path = item.get('video_file')
            # Find a subtitle that matches this video (simplified logic)
            # In a real app, we'd track relationships better
            
            # Check generated subtitles
            base_name = video_path.rsplit('.', 1)[0]
            
            # Try to find a matching subtitle in the context['subtitles']
            # or just use the one that came with download
            
            subtitle_path = None
            if item.get('subtitle_files'):
                subtitle_path = item['subtitle_files'][0]
            
            # If we have translated subs, prefer those
            for sub in context.get('subtitles', []):
                if base_name in sub:
                    subtitle_path = sub
                    break
            
            # Process video if we have subtitles OR watermark
            if video_path and (subtitle_path or watermark_text):
                action_desc = []
                if subtitle_path:
                    action_desc.append("subtitles")
                if watermark_text:
                    action_desc.append(f"watermark '{watermark_text}'")
                
                await self._log(context, f"Processing {os.path.basename(video_path)} with {' and '.join(action_desc)}")
                
                output_path = video_path.replace('.mp4', '_burned.mp4')
                success = subtitle_service.burn_subtitles(
                    video_path,
                    subtitle_path,  # Can be None for watermark-only
                    output_path,
                    watermark_text
                )
                
                if success:
                    await self._log(context, f"Processed video saved to {os.path.basename(output_path)}")
                else:
                    await self._log(context, "Processing failed", level="error")
            elif video_path:
                await self._log(context, f"Skipping {os.path.basename(video_path)} - no subtitles or watermark configured", level="warning")


    async def _handle_upload(self, config: Dict[str, Any], context: Dict[str, Any]):
        """Handle Upload node"""
        platform = config.get('platform')
        account_id = config.get('account')
        
        if not platform or not account_id:
            await self._log(context, "Missing platform or account configuration for upload", level="error")
            return

        downloaded_items = context.get('downloaded_files', [])
        if not downloaded_items:
            await self._log(context, "No files to upload")
            return

        async def progress_callback(message, percent):
            await self._log(context, message)

        for item in downloaded_items:
            video_path = item.get('video_file')
            if not video_path:
                continue
                
            # Prefer burned video if available, else original
            # Check if a burned version exists in the same directory
            burned_path = video_path.replace('.mp4', '_burned.mp4')
            target_file = burned_path if os.path.exists(burned_path) else video_path
            
            await self._log(context, f"Initiating upload for {os.path.basename(target_file)}")
            
            try:
                success = await upload_service.upload_video(
                    target_file, 
                    int(account_id), 
                    platform, 
                    progress_callback
                )
                
                if success:
                    await self._log(context, f"Upload of {os.path.basename(target_file)} completed successfully")
                else:
                    await self._log(context, f"Upload of {os.path.basename(target_file)} failed", level="error")
            except Exception as e:
                await self._log(context, f"Upload error: {str(e)}", level="error")

    async def _log(self, context: Dict[str, Any], message: str, level: str = "info", node_id: str = None):
        """Add log message and broadcast it"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {message}"
        context['logs'].append(log_entry)
        logger.info(message)
        
        await self._broadcast_event("log", {
            "message": message, 
            "timestamp": timestamp, 
            "level": level,
            "node_id": node_id
        })

    async def _broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast event to all connected clients"""
        await manager.broadcast({
            "type": event_type,
            "data": data
        })

# Global instance
workflow_service = WorkflowService()
