import React, { useState, useEffect } from 'react';
import { Link, Download, Check, AlertCircle, Loader2, Play, FolderOpen, Clock, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function SingleDownloader() {
    const [url, setUrl] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isFetchingInfo, setIsFetchingInfo] = useState(false);
    const [downloadId, setDownloadId] = useState(null);
    const [videoInfo, setVideoInfo] = useState(null);
    const [error, setError] = useState(null);
    const [recentDownloads, setRecentDownloads] = useState([]);
    const [options, setOptions] = useState({
        removeWatermark: true,
        downloadSubtitles: false,
        subtitleLanguage: 'en',
    });

    const [playingVideo, setPlayingVideo] = useState(null);

    const { getProgress } = useWebSocket();
    const progressData = downloadId ? getProgress(downloadId) : null;

    const [logs, setLogs] = useState([]);

    // Capture console logs
    useEffect(() => {
        const originalLog = console.log;
        const originalError = console.error;

        console.log = (...args) => {
            setLogs(prev => [...prev.slice(-10), `LOG: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`]);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            setLogs(prev => [...prev.slice(-10), `ERR: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`]);
            originalError.apply(console, args);
        };

        return () => {
            console.log = originalLog;
            console.error = originalError;
        };
    }, []);

    // Fetch recent downloads on mount
    useEffect(() => {
        fetchRecentDownloads();
    }, []);

    const fetchRecentDownloads = async () => {
        try {
            const data = await api.dashboard.activity(10);
            setRecentDownloads(data);
        } catch (err) {
            console.error("Failed to fetch recent downloads:", err);
        }
    };

    const handleFetchInfo = async () => {
        console.log("handleFetchInfo called with url:", url);
        if (!url) {
            console.log("URL is empty, returning");
            return;
        }

        setError(null);
        setIsFetchingInfo(true);
        setVideoInfo(null);
        setDownloadId(null); // Reset previous download state

        try {
            console.log("Calling api.downloads.info...");
            const info = await api.downloads.info(url);
            console.log("API response:", info);
            setVideoInfo(info);
        } catch (err) {
            console.error("API error:", err);
            setError(err.message || 'Failed to fetch video info');
        } finally {
            console.log("Finished fetching info");
            setIsFetchingInfo(false);
        }
    };

    const handleDownload = async () => {
        if (!url) return;

        setError(null);
        setIsDownloading(true);

        try {
            // Start download
            const response = await api.downloads.single(url, {
                remove_watermark: options.removeWatermark,
                download_subtitles: options.downloadSubtitles,
                subtitle_language: options.subtitleLanguage,
            });

            setDownloadId(response.id);
            // Refresh recent list after a short delay to show the new pending task
            setTimeout(fetchRecentDownloads, 1000);
        } catch (err) {
            setError(err.message || 'Failed to start download');
            setIsDownloading(false);
        }
    };

    // Monitor progress via WebSocket
    useEffect(() => {
        if (progressData) {
            if (progressData.status === 'completed') {
                setIsDownloading(false);
                fetchRecentDownloads(); // Refresh list on completion
            } else if (progressData.status === 'failed') {
                setError(progressData.message || 'Download failed');
                setIsDownloading(false);
                fetchRecentDownloads(); // Refresh list on failure
            }
        }
    }, [progressData]);

    const progress = progressData?.progress || 0;
    const status = progressData?.status || 'idle';

    const formatDuration = (seconds) => {
        if (!seconds) return 'Unknown';
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const handlePlay = async (id) => {
        try {
            const response = await api.downloads.play(id);
            setPlayingVideo(response.url);
        } catch (err) {
            console.error("Failed to play video:", err);
            setError("Failed to play video. It might have been moved or deleted.");
        }
    };

    const handleOpenFolder = async (id) => {
        try {
            await api.downloads.openFolder(id);
        } catch (err) {
            console.error("Failed to open folder:", err);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto relative">
            {/* Video Player Modal */}
            {playingVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-black rounded-xl overflow-hidden shadow-2xl max-w-5xl w-full relative">
                        <button
                            onClick={() => setPlayingVideo(null)}
                            className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                        <div className="aspect-video w-full">
                            <video
                                src={playingVideo}
                                controls
                                autoPlay
                                className="w-full h-full"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                    <div
                        className="absolute inset-0 -z-10"
                        onClick={() => setPlayingVideo(null)}
                    />
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Single Video Downloader</h1>
                <p className="text-muted-foreground">Download videos from TikTok, Douyin, and YouTube instantly.</p>
            </div>

            {/* Debug Box */}
            <div className="mb-4 p-4 bg-black/10 border border-black/20 rounded text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60">
                <p><strong>Debug Info:</strong></p>
                <p>URL State: "{url}"</p>
                <p>IsFetching: {isFetchingInfo ? 'Yes' : 'No'}</p>
                <p>VideoInfo: {videoInfo ? 'Present' : 'Null'}</p>
                <p>Error: {error || 'None'}</p>
                <div className="mt-2 pt-2 border-t border-black/10">
                    <p><strong>Logs:</strong></p>
                    {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                    ))}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Downloader */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        {/* URL Input */}
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                                    <Link className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Paste video link here..."
                                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    disabled={isDownloading || isFetchingInfo}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo()}
                                />
                            </div>
                            <button
                                onClick={handleFetchInfo}
                                disabled={isDownloading || isFetchingInfo || !url}
                                className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isFetchingInfo ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Search className="w-5 h-5" />
                                )}
                                <span className="hidden sm:inline">Fetch Info</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        {/* Video Preview & Download Options */}
                        {videoInfo && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="border border-border rounded-lg overflow-hidden bg-accent/5 mb-6">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="w-full md:w-64 aspect-video bg-black/10 relative group">
                                            <img
                                                src={videoInfo.thumbnail_url}
                                                alt={videoInfo.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                                {formatDuration(videoInfo.duration)}
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            <div>
                                                <h3 className="font-medium line-clamp-2 mb-2 text-lg">{videoInfo.title}</h3>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                                                    <span className="flex items-center gap-1 capitalize">
                                                        {videoInfo.extractor}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{videoInfo.view_count?.toLocaleString()} views</span>
                                                    <span>•</span>
                                                    <span>{videoInfo.uploader}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={options.removeWatermark}
                                                        onChange={(e) => setOptions({ ...options, removeWatermark: e.target.checked })}
                                                        className="rounded border-primary text-primary focus:ring-primary"
                                                        disabled={isDownloading}
                                                    />
                                                    <span className="text-sm">Remove Watermark</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={options.downloadSubtitles}
                                                        onChange={(e) => setOptions({ ...options, downloadSubtitles: e.target.checked })}
                                                        className="rounded border-primary text-primary focus:ring-primary"
                                                        disabled={isDownloading}
                                                    />
                                                    <span className="text-sm">Download Subtitles</span>
                                                </label>
                                            </div>

                                            <button
                                                onClick={handleDownload}
                                                disabled={isDownloading}
                                                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isDownloading ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Downloading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-5 h-5" />
                                                        Download Video
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active Download Progress */}
                        {isDownloading && (
                            <div className="border border-border border-dashed rounded-lg p-6 bg-accent/20 text-center animate-in fade-in zoom-in-95 duration-300">
                                <div className="mb-4">
                                    {status === 'completed' ? (
                                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Check className="w-8 h-8" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        </div>
                                    )}
                                    <h3 className="font-medium text-lg">
                                        {status === 'completed' ? 'Download Complete!' :
                                            status === 'processing' ? 'Processing Video...' :
                                                'Downloading...'}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {status === 'completed' ? 'Your video is ready.' : `${Math.round(progress)}%`}
                                    </p>
                                </div>

                                <div className="h-2 bg-secondary rounded-full overflow-hidden max-w-md mx-auto mb-4">
                                    <div
                                        className={cn("h-full transition-all duration-300",
                                            status === 'completed' ? "bg-green-500" : "bg-primary"
                                        )}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Recent Downloads */}
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                            Recent Downloads
                        </h2>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[600px]">
                            {recentDownloads.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Download className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p>No recent downloads</p>
                                </div>
                            ) : (
                                recentDownloads.map((item) => (
                                    <div key={item.id} className="group border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-sm line-clamp-2" title={item.title}>
                                                {item.title}
                                            </h4>
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider",
                                                item.status === 'completed' ? "bg-green-100 text-green-700" :
                                                    item.status === 'failed' ? "bg-red-100 text-red-700" :
                                                        "bg-blue-100 text-blue-700"
                                            )}>
                                                {item.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <span className="capitalize">{item.platform}</span>
                                                <span>•</span>
                                                <span>{item.size}</span>
                                            </div>
                                            <span>{item.time}</span>
                                        </div>

                                        {item.status === 'completed' && (
                                            <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handlePlay(item.id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary py-1.5 rounded text-xs font-medium transition-colors"
                                                >
                                                    <Play className="w-3 h-3" />
                                                    Play
                                                </button>
                                                <button
                                                    onClick={() => handleOpenFolder(item.id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground py-1.5 rounded text-xs font-medium transition-colors"
                                                >
                                                    <FolderOpen className="w-3 h-3" />
                                                    Folder
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
