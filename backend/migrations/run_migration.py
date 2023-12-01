"""
Migration script to add video status tracking fields
"""
import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

load_dotenv()

def run_migration():
    conn = psycopg2.connect(
        host='localhost',
        port='5432',
        database='video_downloader',
        user='postgres',
        password='1'
    )
    
    cursor = conn.cursor()
    
    try:
        print("Running migration: add_video_status_tracking")
        
        # Add status tracking fields to videos table
        cursor.execute("""
            ALTER TABLE videos 
            ADD COLUMN IF NOT EXISTS download_status VARCHAR(50) DEFAULT 'pending';
        """)
        print("✓ Added download_status column")
        
        cursor.execute("""
            ALTER TABLE videos 
            ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'none';
        """)
        print("✓ Added processing_status column")
        
        cursor.execute("""
            ALTER TABLE videos 
            ADD COLUMN IF NOT EXISTS upload_platforms JSONB DEFAULT '{}'::jsonb;
        """)
        print("✓ Added upload_platforms column")
        
        cursor.execute("""
            ALTER TABLE videos 
            ADD COLUMN IF NOT EXISTS download_id INTEGER REFERENCES downloads(id) ON DELETE SET NULL;
        """)
        print("✓ Added download_id foreign key")
        
        # Create indexes for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_videos_download_status ON videos(download_status);
        """)
        print("✓ Created index on download_status")
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_channels_last_sync ON channels(last_sync);
        """)
        print("✓ Created index on channels.last_sync")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    run_migration()
