"""
Quick setup script to initialize the backend
"""
import os
import sys
from pathlib import Path

def create_env_file():
    """Create .env file from .env.example if it doesn't exist"""
    env_example = Path(".env.example")
    env_file = Path(".env")
    
    if not env_file.exists() and env_example.exists():
        print("Creating .env file from .env.example...")
        env_file.write_text(env_example.read_text())
        print(".env file created. Please update with your database credentials.")
    elif env_file.exists():
        print(".env file already exists")
    else:
        print(".env.example not found")

def create_storage_dirs():
    """Create storage directories"""
    print("\nCreating storage directories...")
    dirs = [
        "storage",
        "storage/videos",
        "storage/subtitles",
        "storage/thumbnails"
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"Created {dir_path}/")

def check_dependencies():
    """Check if required dependencies are installed"""
    print("\nChecking dependencies...")
    
    required = [
        "fastapi",
        "uvicorn",
        "sqlalchemy",
        "psycopg2",
        "yt_dlp",
        "googletrans"
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package)
            print(f"{package} installed")
        except ImportError:
            print(f"{package} not installed")
            missing.append(package)
    
    if missing:
        print(f"\nMissing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    return True

def check_database():
    """Check database connection"""
    print("\nChecking database connection...")
    try:
        from database import check_db_connection
        if check_db_connection():
            print("Database connection successful")
            return True
        else:
            print("Database connection failed")
            print("Please check your DATABASE_URL in .env")
            return False
    except Exception as e:
        print(f"Error checking database: {e}")
        print("Make sure PostgreSQL is running and .env is configured")
        return False

def initialize_database():
    """Initialize database tables"""
    print("\nInitializing database tables...")
    try:
        from database import init_db
        init_db()
        print("Database tables created successfully")
        return True
    except Exception as e:
        print(f"Error initializing database: {e}")
        return False

def main():
    """Main setup function"""
    print("=" * 50)
    print("Video Downloader Backend Setup")
    print("=" * 50)
    
    # Step 1: Create .env file
    create_env_file()
    
    # Step 2: Create storage directories
    create_storage_dirs()
    
    # Step 3: Check dependencies
    print("\n" + "=" * 50)
    if not check_dependencies():
        print("\nPlease install dependencies first:")
        print("  pip install -r requirements.txt")
        sys.exit(1)
    
    # Step 4: Check database connection
    print("\n" + "=" * 50)
    if not check_database():
        print("\nPlease configure database in .env and ensure PostgreSQL is running")
        print("Then run this script again")
        sys.exit(1)
    
    # Step 5: Initialize database
    print("\n" + "=" * 50)
    if not initialize_database():
        print("\nDatabase initialization failed")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("Setup complete!")
    print("=" * 50)
    print("\nTo start the server, run:")
    print("  python main.py")
    print("\nOr with uvicorn:")
    print("  uvicorn main:app --reload")
    print("\nAPI Documentation will be available at:")
    print("  http://localhost:8000/docs")

if __name__ == "__main__":
    main()
