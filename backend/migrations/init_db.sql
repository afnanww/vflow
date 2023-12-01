-- Video Downloader Database Schema
-- PostgreSQL 13+

-- Drop existing tables if they exist
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS subtitles CASCADE;
DROP TABLE IF EXISTS downloads CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS workflow_status CASCADE;
DROP TYPE IF EXISTS download_status CASCADE;
DROP TYPE IF EXISTS platform_type CASCADE;

-- Create ENUM types
CREATE TYPE platform_type AS ENUM ('youtube', 'tiktok', 'douyin');
CREATE TYPE download_status AS ENUM ('pending', 'downloading', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE workflow_status AS ENUM ('running', 'completed', 'failed', 'paused');

-- Accounts table
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    platform platform_type NOT NULL,
    username VARCHAR(200) NOT NULL,
    profile_url VARCHAR(1000),
    avatar_url VARCHAR(1000),
    subscribers VARCHAR(50),
    access_token VARCHAR(500),
    refresh_token VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(platform, username)
);

-- Channels table
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    url VARCHAR(1000) NOT NULL UNIQUE,
    platform platform_type NOT NULL,
    channel_id VARCHAR(200),
    avatar_url VARCHAR(1000),
    subscribers VARCHAR(50),
    description TEXT,
    last_sync TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Videos table
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL UNIQUE,
    platform platform_type NOT NULL,
    thumbnail_url VARCHAR(1000),
    duration INTEGER,
    file_path VARCHAR(1000),
    file_size BIGINT,
    views VARCHAR(50),
    upload_date VARCHAR(50),
    description TEXT,
    has_subtitles BOOLEAN DEFAULT FALSE,
    watermark_removed BOOLEAN DEFAULT FALSE,
    channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Downloads table
CREATE TABLE downloads (
    id SERIAL PRIMARY KEY,
    url VARCHAR(1000) NOT NULL,
    status download_status DEFAULT 'pending',
    progress FLOAT DEFAULT 0.0,
    error_message TEXT,
    download_options JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Subtitles table
CREATE TABLE subtitles (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(1000) NOT NULL,
    language VARCHAR(10) NOT NULL,
    format VARCHAR(10),
    is_translated BOOLEAN DEFAULT FALSE,
    source_language VARCHAR(10),
    is_burned BOOLEAN DEFAULT FALSE,
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Workflows table
CREATE TABLE workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    workflow_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    schedule VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Workflow Executions table
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status workflow_status DEFAULT 'running',
    execution_log JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_videos_platform ON videos(platform);
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_downloads_status ON downloads(status);
CREATE INDEX idx_downloads_created_at ON downloads(created_at DESC);
CREATE INDEX idx_channels_platform ON channels(platform);
CREATE INDEX idx_channels_is_active ON channels(is_active);
CREATE INDEX idx_accounts_platform ON accounts(platform);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);

-- Insert sample data (optional)
-- INSERT INTO accounts (platform, username, profile_url, subscribers, is_active)
-- VALUES ('youtube', 'Sample Channel', 'https://youtube.com/@sample', '1M', TRUE);

COMMENT ON TABLE accounts IS 'Linked user accounts for different platforms';
COMMENT ON TABLE channels IS 'Tracked channels for monitoring and bulk downloads';
COMMENT ON TABLE videos IS 'Downloaded video records with metadata';
COMMENT ON TABLE downloads IS 'Download tasks with progress tracking';
COMMENT ON TABLE subtitles IS 'Subtitle files and translations';
COMMENT ON TABLE workflows IS 'Automation workflows';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history';
