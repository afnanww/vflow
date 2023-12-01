"""
Account management API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.schemas import AccountCreate, AccountResponse
from backend.models import Account
from backend.utils.platform_detector import detect_platform

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[AccountResponse])
async def list_accounts(db: Session = Depends(get_db)):
    """Get all linked accounts"""
    try:
        accounts = db.query(Account).filter(Account.is_active == True).all()
        return accounts
    except Exception as e:
        logger.error(f"Error fetching accounts: {e}")
        # Return empty list if database fails
        return []


@router.post("", response_model=AccountResponse)
async def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    """Link a new account"""
    # Check if account already exists (including inactive ones)
    existing = db.query(Account).filter(
        Account.platform == account.platform,
        Account.username == account.username
    ).first()
    
    if existing:
        # If account exists but is inactive, reactivate it
        if not existing.is_active:
            existing.is_active = True
            existing.profile_url = account.profile_url
            existing.credentials = account.credentials
            db.commit()
            db.refresh(existing)
            logger.info(f"Reactivated inactive account: {existing.username} (ID: {existing.id})")
            return existing
        else:
            # Account is already active
            raise HTTPException(status_code=400, detail="Account already linked")
    
    # Create new account
    new_account = Account(
        platform=account.platform,
        username=account.username,
        profile_url=account.profile_url,
        credentials=account.credentials,
        is_active=True
    )
    
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    return new_account


@router.delete("/{account_id}")
async def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Unlink an account"""
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Soft delete - mark as inactive
    account.is_active = False
    db.commit()
    
    return {"message": "Account unlinked successfully"}


@router.post("/{account_id}/sync")
async def sync_account(account_id: int, db: Session = Depends(get_db)):
    """Sync account data - fetches latest profile information from platform"""
    from backend.services.account_service import AccountService
    
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Fetch and update profile data from platform API
    success = AccountService.sync_account_profile(db, account_id)
    
    if not success:
        raise HTTPException(
            status_code=500, 
            detail="Failed to sync account. Please check if the account is still authorized."
        )
    
    # Refresh account data to return updated info
    db.refresh(account)
    
    return {
        "message": "Account synced successfully",
        "account": {
            "id": account.id,
            "username": account.username,
            "avatar_url": account.avatar_url,
            "subscribers": account.subscribers,
            "profile_url": account.profile_url,
            "last_sync": account.last_sync.isoformat() if account.last_sync else None
        }
    }
