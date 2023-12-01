"""
Workflow API routes
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import logging
import os

from backend.database import get_db
from backend.schemas import WorkflowCreate, WorkflowUpdate, WorkflowResponse, WorkflowExecutionResponse
from backend.models import Workflow, WorkflowExecution, WorkflowStatus

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[WorkflowResponse])
async def list_workflows(db: Session = Depends(get_db)):
    """Get all workflows"""
    workflows = db.query(Workflow).filter(Workflow.is_active == True).all()
    return workflows


@router.post("", response_model=WorkflowResponse)
async def create_workflow(workflow: WorkflowCreate, db: Session = Depends(get_db)):
    """Create a new workflow"""
    new_workflow = Workflow(
        name=workflow.name,
        description=workflow.description,
        workflow_data=workflow.workflow_data,
        is_active=workflow.is_active,
        schedule=workflow.schedule
    )
    
    db.add(new_workflow)
    db.commit()
    db.refresh(new_workflow)
    
    return new_workflow


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: int,
    workflow: WorkflowUpdate,
    db: Session = Depends(get_db)
):
    """Update a workflow"""
    db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Update fields
    if workflow.name is not None:
        db_workflow.name = workflow.name
    if workflow.description is not None:
        db_workflow.description = workflow.description
    if workflow.workflow_data is not None:
        db_workflow.workflow_data = workflow.workflow_data
    if workflow.is_active is not None:
        db_workflow.is_active = workflow.is_active
    if workflow.schedule is not None:
        db_workflow.schedule = workflow.schedule
    
    db.commit()
    db.refresh(db_workflow)
    
    return db_workflow


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """Delete a workflow"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Soft delete
    workflow.is_active = False
    db.commit()
    
    return {"message": "Workflow deleted successfully"}


@router.post("/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Execute a workflow"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create execution record
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        status=WorkflowStatus.RUNNING,
        execution_log=["Workflow execution started"]
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Run workflow in background
    from backend.services.workflow_service import workflow_service
    background_tasks.add_task(workflow_service.execute_workflow, workflow_id, execution.id)
    
    return execution


@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
async def get_workflow_executions(workflow_id: int, db: Session = Depends(get_db)):
    """Get workflow execution history"""
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.workflow_id == workflow_id
    ).order_by(WorkflowExecution.started_at.desc()).all()
    
    return executions


@router.get("/history/all", response_model=List[WorkflowExecutionResponse])
async def get_all_executions(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db)
):
    """Get all workflow executions (global history)"""
    executions = db.query(WorkflowExecution).order_by(
        WorkflowExecution.started_at.desc()
    ).offset(skip).limit(limit).all()
    
    return executions


@router.get("/execution/{execution_id}", response_model=WorkflowExecutionResponse)
async def get_execution_details(execution_id: int, db: Session = Depends(get_db)):
    """Get details of a specific execution"""
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    return execution


@router.post("/execution/{execution_id}/cancel")
async def cancel_execution(execution_id: int, db: Session = Depends(get_db)):
    """Cancel a running execution"""
    try:
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        if execution.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED]:
            return {"message": "Execution already finished"}
            
        execution.status = WorkflowStatus.CANCELLED
        execution.completed_at = datetime.now()
        execution.execution_log = execution.execution_log + ["Execution cancelled by user"]
        db.commit()
        
        return {"message": "Execution cancelled"}
    except Exception as e:
        logger.error(f"Error cancelling execution: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/execution/{execution_id}")
async def delete_execution(execution_id: int, db: Session = Depends(get_db)):
    """Delete an execution record and its downloaded files"""
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    if execution.status == WorkflowStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot delete a running execution. Cancel it first.")
    
    # Delete downloaded video files
    deleted_files = []
    if execution.execution_results and execution.execution_results.get('downloaded_files'):
        for file_info in execution.execution_results['downloaded_files']:
            video_file = file_info.get('video_file')
            if video_file and os.path.exists(video_file):
                try:
                    os.remove(video_file)
                    deleted_files.append(video_file)
                    logger.info(f"Deleted video file: {video_file}")
                except Exception as e:
                    logger.error(f"Failed to delete video file {video_file}: {e}")
            
            # Delete subtitle files
            subtitle_files = file_info.get('subtitle_files', [])
            for sub_file in subtitle_files:
                if sub_file and os.path.exists(sub_file):
                    try:
                        os.remove(sub_file)
                        deleted_files.append(sub_file)
                        logger.info(f"Deleted subtitle file: {sub_file}")
                    except Exception as e:
                        logger.error(f"Failed to delete subtitle file {sub_file}: {e}")
        
    db.delete(execution)
    db.commit()
    
    return {
        "message": "Execution deleted successfully",
        "deleted_files": deleted_files
    }
