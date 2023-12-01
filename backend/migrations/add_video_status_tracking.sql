-- Add status tracking fields to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS download_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'none';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS upload_platforms JSONB DEFAULT '{}'::jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS download_id INTEGER REFERENCES downloads(id) ON DELETE SET NULL;

-- Ensure channels table has last_sync
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_download_status ON videos(download_status);
CREATE INDEX IF NOT EXISTS idx_channels_last_sync ON channels(last_sync);
