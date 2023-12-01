"""
Account service for fetching and updating account profile data
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import requests

from backend.models import Account, PlatformType
from backend.config import settings

logger = logging.getLogger(__name__)


class AccountService:
    """Service for managing account profile data"""
    
    @staticmethod
    def fetch_youtube_profile_data(access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch YouTube channel profile data using OAuth access token
        
        Args:
            access_token: YouTube OAuth access token
            
        Returns:
            Dictionary with profile data or None if failed
        """
        try:
            # YouTube Data API v3 endpoint
            url = "https://www.googleapis.com/youtube/v3/channels"
            params = {
                "part": "snippet,statistics",
                "mine": "true"
            }
            headers = {
                "Authorization": f"Bearer {access_token}"
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get("items"):
                logger.warning("No YouTube channel found for this account")
                return None
            
            channel = data["items"][0]
            snippet = channel.get("snippet", {})
            statistics = channel.get("statistics", {})
            
            profile_data = {
                "username": snippet.get("title", ""),
                "avatar_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                "subscribers": statistics.get("subscriberCount", "0"),
                "profile_url": f"https://www.youtube.com/channel/{channel.get('id', '')}"
            }
            
            logger.info(f"Successfully fetched YouTube profile: {profile_data['username']}")
            return profile_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch YouTube profile data: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching YouTube profile: {e}")
            return None
    
    @staticmethod
    def fetch_tiktok_profile_data(access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch TikTok profile data using OAuth access token
        
        Args:
            access_token: TikTok OAuth access token
            
        Returns:
            Dictionary with profile data or None if failed
        """
        # TODO: Implement TikTok API integration
        logger.warning("TikTok profile fetching not yet implemented")
        return {
            "username": "TikTok User",
            "avatar_url": None,
            "subscribers": "0",
            "profile_url": ""
        }
    
    @staticmethod
    def update_account_profile(db: Session, account_id: int, profile_data: Dict[str, Any]) -> bool:
        """
        Update account with fetched profile data
        
        Args:
            db: Database session
            account_id: Account ID to update
            profile_data: Profile data dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            account = db.query(Account).filter(Account.id == account_id).first()
            
            if not account:
                logger.error(f"Account {account_id} not found")
                return False
            
            # Update account fields
            if "username" in profile_data:
                account.username = profile_data["username"]
            if "avatar_url" in profile_data:
                account.avatar_url = profile_data["avatar_url"]
            if "subscribers" in profile_data:
                account.subscribers = profile_data["subscribers"]
            if "profile_url" in profile_data:
                account.profile_url = profile_data["profile_url"]
            
            account.last_sync = datetime.now()
            
            db.commit()
            logger.info(f"Successfully updated account {account_id} profile data")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update account profile: {e}")
            db.rollback()
            return False
    
    @staticmethod
    def sync_account_profile(db: Session, account_id: int) -> bool:
        """
        Fetch and update account profile data
        
        Args:
            db: Database session
            account_id: Account ID to sync
            
        Returns:
            True if successful, False otherwise
        """
        try:
            account = db.query(Account).filter(Account.id == account_id).first()
            
            if not account:
                logger.error(f"Account {account_id} not found")
                return False
            
            if not account.access_token:
                logger.warning(f"Account {account_id} has no access token")
                return False
            
            # Fetch profile data based on platform
            profile_data = None
            if account.platform == PlatformType.YOUTUBE:
                profile_data = AccountService.fetch_youtube_profile_data(account.access_token)
            elif account.platform == PlatformType.TIKTOK:
                profile_data = AccountService.fetch_tiktok_profile_data(account.access_token)
            else:
                logger.warning(f"Unsupported platform: {account.platform}")
                return False
            
            if not profile_data:
                logger.error(f"Failed to fetch profile data for account {account_id}")
                return False
            
            # Update account with profile data
            return AccountService.update_account_profile(db, account_id, profile_data)
            
        except Exception as e:
            logger.error(f"Failed to sync account profile: {e}")
            return False
