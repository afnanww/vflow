from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from backend.config import settings
from backend.database import init_db, check_db_connection


logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    

    try:
        if check_db_connection():
            logger.info("DB connected")

            init_db()
        else:
            logger.warning("DB connection failed")
    except Exception as e:
        logger.error(f"DB init error: {e}")
    

    os.makedirs(settings.STORAGE_PATH, exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "videos"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "subtitles"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_PATH, "thumbnails"), exist_ok=True)
    
    logger.info("Startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutdown")



app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Video downloader API for YouTube, TikTok, and Douyin",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if os.path.exists(settings.STORAGE_PATH):
    app.mount("/storage", StaticFiles(directory=settings.STORAGE_PATH), name="storage")



from backend.routes import downloads, accounts, workflows, dashboard, storage, channels, auth, watermarks
from backend.websocket_manager import manager

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(downloads.router, prefix="/api/downloads", tags=["Downloads"])
app.include_router(channels.router, prefix="/api/channels", tags=["Channels"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(watermarks.router, prefix="/api/watermarks", tags=["Watermarks"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(storage.router, prefix="/api/storage", tags=["Storage"])

@app.websocket("/ws/workflow-events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = check_db_connection()
    return {
        "status": "healthy" if db_status else "unhealthy",
        "database": "connected" if db_status else "disconnected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_excludes=["*.log"]
    )
