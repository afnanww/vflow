import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, Trash2, CheckSquare, Square, PlayCircle, Save, History, Settings, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function ChannelScanner() {
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [scanMode, setScanMode] = useState('partial'); // 'full' or 'partial'
    const [maxVideos, setMaxVideos] = useState(10);
    const [isScanning, setIsScanning] = useState(false);
    const [videos, setVideos] = useState([]);
    const [selectedVideos, setSelectedVideos] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState(null);
    const [channelInfo, setChannelInfo] = useState(null);
    const [globalOptions, setGlobalOptions] = useState({
        watermark: false,
        subtitles: true,
        subtitleLang: 'en',
    });

    const { getProgress } = useWebSocket();

    useEffect(() => {
        const urlParam = searchParams.get('url');
        if (urlParam) {
            setQuery(urlParam);
            handleScan(urlParam);
        }
    }, [searchParams]);

    const handleScan = async (channelUrl = query) => {
        if (!channelUrl) return;

        setIsScanning(true);
        setError(null);
        setVideos([]);
        setChannelInfo(null);

        try {
            // If full scan mode, use a large number to get all videos
            const videosToScan = scanMode === 'full' ? 1000 : maxVideos;
            const result = await api.downloads.scan(channelUrl, videosToScan);

            if (!result || !result.videos) {
                throw new Error('No videos found. Please check the URL and try again.');
            }

            setChannelInfo({
                name: result.channel_name || 'Unknown Channel',
                url: result.channel_url || channelUrl,
                videoCount: result.videos?.length || 0,
            });

            setVideos(result.videos || []);
        } catch (err) {
            console.error('Error scanning channel:', err);
            // Extract meaningful error message
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to scan channel. Please verify the URL.';
            setError(errorMessage);
        } finally {
            setIsScanning(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedVideos.length === videos.length) {
            setSelectedVideos([]);
        } else {
            setSelectedVideos(videos.map(v => v.id || v.url));
        }
    };

    const toggleVideo = (videoId) => {
        setSelectedVideos(prev =>
            prev.includes(videoId)
                ? prev.filter(id => id !== videoId)
                : [...prev, videoId]
        );
    };

    const handleBulkDownload = async () => {
        if (selectedVideos.length === 0) return;

        const selectedUrls = videos
            .filter(v => selectedVideos.includes(v.id || v.url))
            .map(v => v.url);

        try {
            await api.downloads.bulk(selectedUrls, {
                remove_watermark: globalOptions.watermark,
                download_subtitles: globalOptions.subtitles,
                subtitle_language: globalOptions.subtitleLang,
            });

            // Clear selection after starting download
            setSelectedVideos([]);
        } catch (err) {
            console.error('Error starting bulk download:', err);
            setError(err.message || 'Failed to start bulk download');
        }
    };

    const handleDeleteSelected = () => {
        setVideos(prev => prev.filter(v => !selectedVideos.includes(v.id || v.url)));
        setSelectedVideos([]);
    };

    const getVideoStatus = (video) => {
        const progress = getProgress(video.download_id);
        if (progress) {
            return {
                status: progress.status,
                progress: progress.progress,
            };
        }
        return {
            status: video.status || 'new',
            progress: video.progress || 0,
        };
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Channel Scanner</h1>
                <p className="text-muted-foreground mt-2">Scan and download entire channels from YouTube, TikTok, and Douyin.</p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="Paste channel URL here..."
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                        disabled={isScanning}
                    />
                </div>
                <div className="flex items-center gap-3">
                    {/* Scan Mode Selector */}
                    <div className="flex flex-col gap-2 bg-card border border-border rounded-lg p-3">
                        <label className="text-xs font-medium text-muted-foreground">Scan Mode</label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="scanMode"
                                    value="full"
                                    checked={scanMode === 'full'}
                                    onChange={(e) => setScanMode(e.target.value)}
                                    disabled={isScanning}
                                    className="w-4 h-4 text-primary"
                                />
                                <span className="text-sm">Scan All</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="scanMode"
                                    value="partial"
                                    checked={scanMode === 'partial'}
                                    onChange={(e) => setScanMode(e.target.value)}
                                    disabled={isScanning}
                                    className="w-4 h-4 text-primary"
                                />
                                <span className="text-sm">Partial</span>
                            </label>
                        </div>
                    </div>

                    {/* Max Videos Input - Only show in partial mode */}
                    {scanMode === 'partial' && (
                        <div className="flex flex-col">
                            <label className="text-xs text-muted-foreground mb-1">Max Videos</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={maxVideos}
                                onChange={(e) => setMaxVideos(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
                                className="w-20 px-3 py-3 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center"
                                disabled={isScanning}
                            />
                        </div>
                    )}
                </div>
                <button
                    onClick={() => handleScan()}
                    disabled={isScanning || !query}
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        <>
                            Scan Channel
                            <Search className="w-5 h-5" />
                        </>
                    )}
                </button>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                    title="Scan History"
                >
                    <History className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Channel Info */}
            {channelInfo && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{channelInfo.name}</h2>
                            <p className="text-sm text-muted-foreground mt-1">{channelInfo.videoCount} videos found</p>
                        </div>
                        <button className="p-2 rounded-lg border border-border hover:bg-accent transition-colors">
                            <Save className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Global Options */}
            {videos.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Global Download Options
                        </h3>
                    </div>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={globalOptions.watermark}
                                onChange={(e) => setGlobalOptions({ ...globalOptions, watermark: e.target.checked })}
                                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                            />
                            <span className="text-sm">Remove Watermark</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={globalOptions.subtitles}
                                onChange={(e) => setGlobalOptions({ ...globalOptions, subtitles: e.target.checked })}
                                className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                            />
                            <span className="text-sm">Download Subtitles</span>
                        </label>
                        {globalOptions.subtitles && (
                            <select
                                value={globalOptions.subtitleLang}
                                onChange={(e) => setGlobalOptions({ ...globalOptions, subtitleLang: e.target.value })}
                                className="text-sm px-2 py-1 rounded border border-input bg-background"
                            >
                                <option value="en">English</option>
                                <option value="id">Bahasa Indonesia</option>
                                <option value="zh">Chinese (Simplified)</option>
                            </select>
                        )}
                    </div>
                </div>
            )}

            {/* Action Bar */}
            {videos.length > 0 && (
                <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                        >
                            {selectedVideos.length === videos.length ? (
                                <CheckSquare className="w-5 h-5" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                            Select All ({selectedVideos.length}/{videos.length})
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedVideos.length === 0}
                            className="px-4 py-2 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                        <button
                            onClick={handleBulkDownload}
                            disabled={selectedVideos.length === 0}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Videos List */}
            {isScanning ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : videos.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border rounded-xl">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Paste a channel URL and click "Scan Channel" to get started</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-border">
                        {videos.map((video) => {
                            const videoId = video.id || video.url;
                            const isSelected = selectedVideos.includes(videoId);
                            const { status, progress } = getVideoStatus(video);

                            return (
                                <div
                                    key={videoId}
                                    className={cn(
                                        "flex items-center gap-4 p-4 transition-all cursor-pointer hover:bg-accent/50",
                                        isSelected && "bg-primary/5 border-l-4 border-l-primary"
                                    )}
                                    onClick={() => toggleVideo(videoId)}
                                >
                                    {/* Checkbox */}
                                    <div className="flex-shrink-0">
                                        {isSelected ? (
                                            <CheckSquare className="w-5 h-5 text-primary" />
                                        ) : (
                                            <Square className="w-5 h-5 text-muted-foreground" />
                                        )}
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="relative w-40 aspect-video bg-black/10 rounded-lg overflow-hidden flex-shrink-0">
                                        {video.thumbnail_url ? (
                                            <img
                                                src={video.thumbnail_url}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                                <PlayCircle className="w-8 h-8 text-muted-foreground" />
                                            </div>
                                        )}
                                        {video.duration && (
                                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                                                {typeof video.duration === 'number'
                                                    ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`
                                                    : video.duration}
                                            </div>
                                        )}
                                        {status !== 'new' && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                {status === 'completed' || status === 'uploaded' ? (
                                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                                ) : status === 'downloading' || status === 'processing' || status === 'uploading' ? (
                                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                ) : null}
                                            </div>
                                        )}
                                    </div>

                                    {/* Video Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm line-clamp-2 mb-1" title={video.title}>
                                            {video.title}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>{video.views || '0'} views</span>
                                            {video.upload_date && (
                                                <>
                                                    <span>•</span>
                                                    <span>{video.upload_date}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Progress Bar for Active Downloads */}
                                        {(status === 'downloading' || status === 'processing' || status === 'uploading') && (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                    <span className="capitalize">{status}</span>
                                                    <span>{Math.round(progress)}%</span>
                                                </div>
                                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex-shrink-0">
                                        {status === 'completed' || status === 'uploaded' ? (
                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                                                <CheckCircle className="w-3 h-3" />
                                                Done
                                            </span>
                                        ) : status === 'downloading' || status === 'processing' || status === 'uploading' ? (
                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {Math.round(progress)}%
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
