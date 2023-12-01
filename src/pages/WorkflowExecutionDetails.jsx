import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Clock, CheckCircle2, AlertCircle, Loader2, StopCircle, Trash2,
    Video, Download, FileText, Play, Folder, Calendar, Eye
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import ConfirmationModal from '../components/ConfirmationModal';

export default function WorkflowExecutionDetails() {
    const { executionId } = useParams();
    const navigate = useNavigate();
    const [execution, setExecution] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [scannedVideos, setScannedVideos] = useState([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [stopModalOpen, setStopModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchExecutionDetails();

        // WebSocket for real-time updates
        const ws = new WebSocket('ws://localhost:8000/ws/workflow-events');

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'log') {
                setExecution(prev => {
                    if (!prev) return prev;
                    const logEntry = `[${message.data.timestamp}] ${message.data.message}`;
                    return {
                        ...prev,
                        execution_log: [...(prev.execution_log || []), logEntry]
                    };
                });
            } else if (message.type === 'videos_scanned') {
                // Display scanned videos immediately
                setScannedVideos(message.data.videos || []);
            } else if (message.type === 'video_started') {
                // Update video status to processing
                setScannedVideos(prev => {
                    const updated = [...prev];
                    if (updated[message.data.video_index]) {
                        updated[message.data.video_index].status = 'processing';
                    }
                    return updated;
                });
            } else if (message.type === 'video_stage_update') {
                // Update current stage for video
                setScannedVideos(prev => {
                    const updated = [...prev];
                    if (updated[message.data.video_index]) {
                        updated[message.data.video_index].current_stage = message.data.stage;
                        if (updated[message.data.video_index].stages) {
                            updated[message.data.video_index].stages[message.data.stage] = message.data.status;
                        }
                    }
                    return updated;
                });
            } else if (message.type === 'video_completed') {
                // Update video status to completed
                setScannedVideos(prev => {
                    const updated = [...prev];
                    if (updated[message.data.video_index]) {
                        updated[message.data.video_index].status = 'completed';
                        updated[message.data.video_index].current_stage = null;
                    }
                    return updated;
                });
            } else if (message.type === 'video_failed') {
                // Update video status to failed
                setScannedVideos(prev => {
                    const updated = [...prev];
                    if (updated[message.data.video_index]) {
                        updated[message.data.video_index].status = 'failed';
                        updated[message.data.video_index].error = message.data.error;
                    }
                    return updated;
                });
            } else if (['workflow_completed', 'workflow_failed'].includes(message.type)) {
                fetchExecutionDetails();
            }
        };

        return () => ws.close();
    }, [executionId]);

    const fetchExecutionDetails = async () => {
        try {
            const data = await api.workflows.getExecutionDetails(executionId);
            setExecution(data);

            // Restore scanned videos from history if available
            if (data.execution_results?.scanned_videos) {
                setScannedVideos(data.execution_results.scanned_videos);
            }
        } catch (err) {
            console.error("Failed to fetch execution details:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'N/A';
        const mb = bytes / (1024 * 1024);
        if (mb > 1024) {
            return `${(mb / 1024).toFixed(2)} GB`;
        }
        return `${mb.toFixed(2)} MB`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!execution) {
        return (
            <div className="container mx-auto p-6">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Execution Not Found</h2>
                    <button
                        onClick={() => navigate('/history')}
                        className="text-primary hover:underline"
                    >
                        Back to History
                    </button>
                </div>
            </div>
        );
    }

    const results = execution.execution_results || {};
    const downloadedFiles = results.downloaded_files || [];

    return (
        <div className="container mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/history')}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to History
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Workflow Execution #{execution.id}</h1>
                        <p className="text-muted-foreground">
                            Workflow ID: {execution.workflow_id}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {execution.status === 'running' && (
                            <button
                                onClick={() => setStopModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors font-medium"
                            >
                                <StopCircle className="w-4 h-4" />
                                Stop Execution
                            </button>
                        )}

                        {execution.status !== 'running' && (
                            <button
                                onClick={() => setDeleteModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Record
                            </button>
                        )}

                        {/* Status Badge */}
                        <div className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg",
                            execution.status === 'running' ? "bg-primary/10 text-primary" :
                                execution.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                    execution.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                        "bg-gray-500/10 text-gray-500"
                        )}>
                            {execution.status === 'running' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                execution.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                    execution.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                                        <StopCircle className="w-5 h-5" />}
                            <span className="font-semibold capitalize">{execution.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        Started
                    </div>
                    <div className="text-lg font-semibold">
                        {new Date(execution.started_at).toLocaleString()}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Completed
                    </div>
                    <div className="text-lg font-semibold">
                        {execution.completed_at ? new Date(execution.completed_at).toLocaleString() : 'In Progress'}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Video className="w-4 h-4" />
                        Videos Scanned
                    </div>
                    <div className="text-lg font-semibold">
                        {results.scanned_videos_count || 0}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Download className="w-4 h-4" />
                        Videos Downloaded
                    </div>
                    <div className="text-lg font-semibold">
                        {results.videos_count || 0}
                    </div>
                </div>
            </div>

            {/* Scanned Videos (shown immediately after scan) */}
            {scannedVideos.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary" />
                        Scanned Videos ({scannedVideos.length})
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        These videos will be processed through the workflow pipeline
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {scannedVideos.map((video, index) => (
                            <div
                                key={index}
                                className="rounded-lg border border-border bg-accent/20 overflow-hidden hover:shadow-md transition-all duration-200"
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video bg-accent overflow-hidden">
                                    {video.thumbnail_url ? (
                                        <img
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Video className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className={cn(
                                        "absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium",
                                        video.status === 'pending' ? "bg-gray-500/80 text-white" :
                                            video.status === 'processing' ? "bg-primary/80 text-primary-foreground" :
                                                video.status === 'completed' ? "bg-green-500/80 text-white" :
                                                    "bg-red-500/80 text-white"
                                    )}>
                                        {video.status || 'pending'}
                                    </div>
                                </div>

                                {/* Video Info */}
                                <div className="p-3">
                                    <h3 className="font-semibold text-xs line-clamp-2 min-h-[2rem]">
                                        {video.title || 'Unknown Title'}
                                    </h3>

                                    {/* Current Stage */}
                                    {video.current_stage && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            <span className="font-medium">Stage:</span> {video.current_stage}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Downloaded Videos */}
            {downloadedFiles.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary" />
                        Downloaded Videos
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {downloadedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="group rounded-lg border border-border bg-accent/20 overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-primary/50"
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video bg-accent overflow-hidden">
                                    {file.info?.thumbnail_url ? (
                                        <img
                                            src={file.info.thumbnail_url}
                                            alt={file.info.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Video className="w-12 h-12 text-muted-foreground" />
                                        </div>
                                    )}

                                    {/* Duration Badge */}
                                    {file.info?.duration && (
                                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                            {formatDuration(file.info.duration)}
                                        </div>
                                    )}

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => setSelectedVideo(file)}
                                            className="p-3 bg-primary rounded-full hover:bg-primary/90 transition-colors"
                                        >
                                            <Play className="w-5 h-5 text-primary-foreground fill-current" />
                                        </button>
                                    </div>
                                </div>

                                {/* Video Info */}
                                <div className="p-3">
                                    <h3 className="font-semibold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                                        {file.info?.title || 'Unknown Title'}
                                    </h3>

                                    {/* Metadata */}
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        {file.file_size && (
                                            <div className="flex items-center gap-1">
                                                <Download className="w-3 h-3" />
                                                <span>{formatFileSize(file.file_size)}</span>
                                            </div>
                                        )}
                                        {file.info?.views && (
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                <span>{file.info.views} views</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Execution Log */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Execution Log
                </h2>

                <div className="bg-background rounded-lg p-4 font-mono text-xs text-muted-foreground max-h-96 overflow-y-auto border border-border">
                    {execution.execution_log && execution.execution_log.length > 0 ? (
                        execution.execution_log.map((log, i) => (
                            <div key={i} className="py-1 border-b border-border/50 last:border-0">
                                {log}
                            </div>
                        ))
                    ) : (
                        <p className="italic">No logs available</p>
                    )}
                </div>

                {execution.error_message && (
                    <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
                        <span className="font-bold">Error:</span> {execution.error_message}
                    </div>
                )}
            </div>

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={async () => {
                    setActionLoading(true);
                    try {
                        await api.workflows.deleteExecution(execution.id);
                        navigate('/history');
                    } catch (err) {
                        console.error("Failed to delete execution:", err);
                    } finally {
                        setActionLoading(false);
                        setDeleteModalOpen(false);
                    }
                }}
                title="Delete Execution Record"
                message="Are you sure you want to delete this execution record? This will also permanently delete all downloaded video files associated with this execution. This action cannot be undone."
                confirmText="Delete Permanently"
                variant="danger"
                isLoading={actionLoading}
            />

            <ConfirmationModal
                isOpen={stopModalOpen}
                onClose={() => setStopModalOpen(false)}
                onConfirm={async () => {
                    setActionLoading(true);
                    try {
                        await api.workflows.cancel(execution.id);
                        fetchExecutionDetails();
                    } catch (err) {
                        console.error("Failed to stop workflow:", err);
                    } finally {
                        setActionLoading(false);
                        setStopModalOpen(false);
                    }
                }}
                title="Stop Execution"
                message="Are you sure you want to stop this running workflow? Any current downloads will be interrupted."
                confirmText="Stop Execution"
                variant="warning"
                isLoading={actionLoading}
            />

            {/* Video Details Modal */}
            {selectedVideo && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedVideo(null)}
                >
                    <div
                        className="bg-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <h2 className="text-2xl font-bold pr-8">{selectedVideo.info?.title || 'Video Details'}</h2>
                                <button
                                    onClick={() => setSelectedVideo(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Video Player */}
                            <div className="aspect-video bg-black rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                                {selectedVideo.video_file ? (
                                    <video
                                        controls
                                        className="w-full h-full"
                                        src={`http://localhost:8000/storage/videos/${selectedVideo.video_file.split(/[\\/]/).pop()}`}
                                        poster={selectedVideo.info?.thumbnail_url}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                ) : (
                                    <div className="text-center text-white">
                                        <AlertCircle className="w-16 h-16 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm opacity-75">Video file not available</p>
                                    </div>
                                )}
                            </div>

                            {/* Video Details */}
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">File Path:</span>
                                    <span className="font-mono text-xs">{selectedVideo.video_file}</span>
                                </div>
                                {selectedVideo.info?.duration && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span>{formatDuration(selectedVideo.info.duration)}</span>
                                    </div>
                                )}
                                {selectedVideo.file_size && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">File Size:</span>
                                        <span>{formatFileSize(selectedVideo.file_size)}</span>
                                    </div>
                                )}
                                {selectedVideo.subtitle_files && selectedVideo.subtitle_files.length > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtitles:</span>
                                        <span>{selectedVideo.subtitle_files.length} file(s)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
