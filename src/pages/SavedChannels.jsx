import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Video, Trash2, RefreshCw, Calendar, Eye, Download, Upload, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export default function SavedChannels() {
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [channelVideos, setChannelVideos] = useState([]);
    const [loadingVideos, setLoadingVideos] = useState(false);

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.channels.list();
            setChannels(data.channels || []);
        } catch (err) {
            console.error('Error loading channels:', err);
            setError('Failed to load channels');
        } finally {
            setLoading(false);
        }
    };

    const loadChannelVideos = async (channelId) => {
        try {
            setLoadingVideos(true);
            // The API client doesn't have a specific method for getting channel details yet,
            // but we can use the generic client.get or add it to api.js.
            // Let's check api.js again. It has api.channels.list, delete, sync.
            // It seems we need to add 'get' to api.channels or use client.get directly.
            // For now, I'll use the client.get via a new method in api.js or just assume I'll add it.
            // Actually, let's check api.js content again to be sure.
            // Wait, I can't check it inside this tool call.
            // I'll assume I need to update api.js first to add get channel detail.
            // But for now, let's use the pattern api.channels.get(channelId) and I will update api.js next.
            const data = await api.channels.get(channelId);
            setSelectedChannel(data.channel);
            setChannelVideos(data.videos || []);
        } catch (err) {
            console.error('Error loading channel videos:', err);
            setError('Failed to load channel videos');
        } finally {
            setLoadingVideos(false);
        }
    };

    const deleteChannel = async (channelId) => {
        if (!confirm('Are you sure you want to delete this channel?')) return;

        try {
            await api.channels.delete(channelId);
            loadChannels();
            if (selectedChannel?.id === channelId) {
                setSelectedChannel(null);
                setChannelVideos([]);
            }
        } catch (err) {
            console.error('Error deleting channel:', err);
            alert('Failed to delete channel');
        }
    };

    const getStatusBadge = (downloadStatus, processingStatus, uploadPlatforms) => {
        if (downloadStatus === 'downloaded') {
            const platforms = Object.keys(uploadPlatforms || {}).filter(p => uploadPlatforms[p]?.uploaded);
            if (platforms.length > 0) {
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                        <Upload className="w-3 h-3" />
                        Uploaded: {platforms.join(', ')}
                    </span>
                );
            }
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <Download className="w-3 h-3" />
                    Downloaded
                </span>
            );
        }

        if (downloadStatus === 'downloading') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Downloading
                </span>
            );
        }

        if (processingStatus === 'processing') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                Pending
            </span>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Saved Channels</h1>
                <p className="text-muted-foreground mt-2">View and manage your scanned channels</p>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Channels List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Channels ({channels.length})</h2>
                        <button
                            onClick={loadChannels}
                            className="p-2 rounded-lg hover:bg-accent transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {channels.length === 0 ? (
                        <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No saved channels yet</p>
                            <button
                                onClick={() => navigate('/channels')}
                                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Scan a Channel
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {channels.map((channel) => (
                                <div
                                    key={channel.id}
                                    className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 ${selectedChannel?.id === channel.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                                        }`}
                                    onClick={() => loadChannelVideos(channel.id)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">{channel.name}</h3>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <Video className="w-3 h-3" />
                                                <span>{channel.video_count} videos</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <Calendar className="w-3 h-3" />
                                                <span>Scanned {formatDate(channel.last_sync)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteChannel(channel.id);
                                            }}
                                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Delete channel"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Channel Videos */}
                <div className="lg:col-span-2">
                    {!selectedChannel ? (
                        <div className="bg-card border border-border rounded-xl p-12 text-center h-full flex items-center justify-center">
                            <div>
                                <Eye className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <p className="text-lg font-medium text-muted-foreground">Select a channel to view videos</p>
                            </div>
                        </div>
                    ) : loadingVideos ? (
                        <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            {/* Channel Header */}
                            <div className="p-6 border-b border-border">
                                <h2 className="text-2xl font-bold">{selectedChannel.name}</h2>
                                <p className="text-sm text-muted-foreground mt-1">{channelVideos.length} videos</p>
                            </div>

                            {/* Videos List */}
                            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                                {channelVideos.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No videos found
                                    </div>
                                ) : (
                                    channelVideos.map((video) => (
                                        <div key={video.id} className="p-4 hover:bg-accent/50 transition-colors">
                                            <div className="flex gap-4">
                                                {/* Thumbnail */}
                                                {video.thumbnail_url && (
                                                    <img
                                                        src={video.thumbnail_url}
                                                        alt={video.title}
                                                        className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                                                    />
                                                )}

                                                {/* Video Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium line-clamp-2">{video.title}</h3>
                                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                        {video.views && (
                                                            <span className="flex items-center gap-1">
                                                                <Eye className="w-3 h-3" />
                                                                {video.views}
                                                            </span>
                                                        )}
                                                        {video.upload_date && <span>{video.upload_date}</span>}
                                                    </div>
                                                    <div className="mt-2">
                                                        {getStatusBadge(
                                                            video.download_status,
                                                            video.processing_status,
                                                            video.upload_platforms
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
