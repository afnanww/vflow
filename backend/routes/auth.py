"""
Authentication routes for OAuth integration
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
import logging
import urllib.parse
import google_auth_oauthlib.flow
import googleapiclient.discovery
import httpx

from backend.database import get_db
from backend.config import settings
from backend.models import Account, PlatformType

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{platform}/authorize")
async def get_oauth_url(platform: str):
    """Generate OAuth authorization URL"""
    
    import os
    logger.error(f"DEBUG: CWD={os.getcwd()}")
    logger.error(f"DEBUG: Settings YOUTUBE_CLIENT_ID='{settings.YOUTUBE_CLIENT_ID}'")
    logger.error(f"DEBUG: Env YOUTUBE_CLIENT_ID='{os.environ.get('YOUTUBE_CLIENT_ID')}'")
    
    if platform == PlatformType.YOUTUBE:
        if not settings.YOUTUBE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="YouTube Client ID not configured")
            
        # Google OAuth 2.0 URL
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            "client_id": settings.YOUTUBE_CLIENT_ID,
            "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
            "access_type": "offline",
            "prompt": "consent"
        }
        auth_url = f"{base_url}?{urllib.parse.urlencode(params)}"
        return {"auth_url": auth_url}
        
    elif platform == PlatformType.TIKTOK:
        if not settings.TIKTOK_CLIENT_KEY:
            raise HTTPException(status_code=500, detail="TikTok Client Key not configured")
            
        # TikTok OAuth URL
        base_url = "https://www.tiktok.com/auth/authorize/"
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "redirect_uri": settings.TIKTOK_REDIRECT_URI,
            "response_type": "code",
            "scope": "video.upload,user.info.basic"
        }
        auth_url = f"{base_url}?{urllib.parse.urlencode(params)}"
        return {"auth_url": auth_url}
        
    elif platform == PlatformType.DOUYIN:
        # Douyin OAuth URL (Placeholder)
        return {"auth_url": "#"}
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported platform")

@router.post("/{platform}/callback")
async def oauth_callback(
    platform: str, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle OAuth callback and store tokens"""
    data = await request.json()
    code = data.get("code")
    
    logger.error(f"=== OAuth Callback Started ===")
    logger.error(f"Platform: {platform}")
    logger.error(f"Code received: {code[:20] if code else 'None'}...")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code missing")
        
    # Real token exchange
    access_token = ""
    refresh_token = ""
    username = ""
    
    try:
        if platform == PlatformType.YOUTUBE:
            # Exchange code for tokens using Google OAuth
            flow = google_auth_oauthlib.flow.Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.YOUTUBE_CLIENT_ID,
                        "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [settings.YOUTUBE_REDIRECT_URI]
                    }
                },
                scopes=["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]
            )
            flow.redirect_uri = settings.YOUTUBE_REDIRECT_URI
            
            # Fetch token
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            access_token = credentials.token
            refresh_token = credentials.refresh_token
            
            # Get channel info to use as username
            service = googleapiclient.discovery.build('youtube', 'v3', credentials=credentials)
            channels_response = service.channels().list(mine=True, part='snippet').execute()
            
            if channels_response.get('items'):
                username = channels_response['items'][0]['snippet']['title']
            else:
                username = "YouTube User"
                
        elif platform == PlatformType.TIKTOK:
            # Exchange code for tokens using TikTok API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://open.tiktokapis.com/v2/oauth/token/",
                    data={
                        "client_key": settings.TIKTOK_CLIENT_KEY,
                        "client_secret": settings.TIKTOK_CLIENT_SECRET,
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": settings.TIKTOK_REDIRECT_URI,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code != 200:
                    error_detail = response.text
                    logger.error(f"TikTok token exchange failed: {error_detail}")
                    raise HTTPException(status_code=400, detail=f"TikTok authentication failed: {error_detail}")
                    
                token_data = response.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token")
                open_id = token_data.get("open_id")
                
                # Fetch user info for username
                # Note: This requires the user.info.basic scope
                user_response = await client.get(
                    "https://open.tiktokapis.com/v2/user/info/",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"fields": "display_name,avatar_url"}
                )
                
                if user_response.status_code == 200:
                    user_data = user_response.json().get("data", {})
                    username = user_data.get("display_name", f"TikTok User {open_id}")
                else:
                    username = f"TikTok User {open_id}"
                    
        else:
             raise HTTPException(status_code=400, detail="Unsupported platform for token exchange")
             
    except Exception as e:
        logger.error(f"OAuth token exchange error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

    # Check if account exists (including inactive ones)
    account = db.query(Account).filter(
        Account.platform == platform,
        Account.username == username
    ).first()
    
    if not account:
        # Create new account
        account = Account(
            platform=platform,
            username=username,
            profile_url="",
            credentials={},
            access_token=access_token,
            refresh_token=refresh_token,
            is_active=True
        )
        db.add(account)
        logger.info(f"Created new account: {username} (Platform: {platform})")
    else:
        # Update existing account (whether active or inactive)
        account.access_token = access_token
        account.refresh_token = refresh_token
        # Reactivate if it was inactive
        if not account.is_active:
            account.is_active = True
            logger.info(f"Reactivated inactive account: {username} (ID: {account.id})")
        else:
            logger.info(f"Updated existing account: {username} (ID: {account.id})")
    
    logger.error(f"=== Saving account to database ===")
    logger.error(f"Username: {account.username}, Platform: {account.platform}")
    logger.error(f"Has access_token: {bool(access_token)}, Has refresh_token: {bool(refresh_token)}")
        
    db.commit()
    db.refresh(account)
    
    logger.error(f"=== Account saved successfully, ID: {account.id} ===")
    
    return {"message": "Successfully authenticated", "account": account}
