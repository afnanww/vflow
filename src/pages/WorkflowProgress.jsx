import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, XCircle, Loader2, Download, Languages, Flame, Upload } from 'lucide-react';
import api from '../lib/api';
import useWebSocket from '../hooks/useWebSocket';

export default function WorkflowProgress() {
    const { workflowId, executionId } = useParams();
    const navigate = useNavigate();
    const [execution, setExecution] = useState(null);
    const [workflow, setWorkflow] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    // WebSocket connection
    const { lastMessage } = useWebSocket();

    // Load initial data
    useEffect(() => {
        loadData();
    }, [workflowId, executionId]);

    // Handle WebSocket messages
    useEffect(() => {
        if (!lastMessage) return;

        const { type, data } = lastMessage;

        switch (type) {
            case 'videos_scanned':
                if (data.execution_id === parseInt(executionId)) {
                    setVideos(data.videos);
                }
                break;

            case 'video_started':
                if (data.execution_id === parseInt(executionId)) {
                    setVideos(prev => prev.map((v, idx) =>
                        idx === data.video_index ? { ...v, status: 'processing' } : v
                    ));
                }
                break;

            case 'video_stage_update':
                if (data.execution_id === parseInt(executionId)) {
                    setVideos(prev => prev.map((v, idx) =>
                        idx === data.video_index
                            ? {
                                ...v,
                                current_stage: data.status === 'running' ? data.stage : v.current_stage,
                                stages: { ...v.stages, [data.stage]: data.status }
                            }
                            : v
                    ));
                }
                break;

            case 'video_completed':
                if (data.execution_id === parseInt(executionId)) {
                    setVideos(prev => prev.map((v, idx) =>
                        idx === data.video_index
                            ? { ...v, status: 'completed', current_stage: null }
                            : v
                    ));
                }
                break;

            case 'video_failed':
                if (data.execution_id === parseInt(executionId)) {
                    setVideos(prev => prev.map((v, idx) =>
                        idx === data.video_index
                            ? { ...v, status: 'failed', error: data.error }
                            : v
                    ));
                }
                break;

            case 'workflow_completed':
            case 'workflow_failed':
                if (data.execution_id === parseInt(executionId)) {
                    loadData(); // Refresh data
                }
                break;
        }
    }, [lastMessage, executionId]);

    const loadData = async () => {
        try {
            const [execResp, workflowResp] = await Promise.all([
                api.executions.get(executionId),
                api.workflows.get(workflowId)
            ]);

            setExecution(execResp.data);
            setWorkflow(workflowResp.data);

            // If execution has video_progress in results, use it
            if (execResp.data.execution_results?.video_progress) {
                setVideos(execResp.data.execution_results.video_progress);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStageIcon = (stage) => {
        switch (stage) {
            case 'download': return Download;
            case 'translate': return Languages;
            case 'burn': return Flame;
            case 'upload': return Upload;
            default: return Circle;
        }
    };

    const getStageLabel = (stage) => {
        switch (stage) {
            case 'download': return 'Download';
            case 'translate': return 'Translate';
            case 'burn': return 'Burn Subs';
            case 'upload': return 'Upload';
            default: return stage;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <Circle className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-500/10 border-green-500/20';
            case 'processing': return 'bg-blue-500/10 border-blue-500/20 ring-2 ring-blue-500/30';
            case 'failed': return 'bg-red-500/10 border-red-500/20';
            default: return 'bg-muted/50 border-border';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const completedCount = videos.filter(v => v.status === 'completed').length;
    const failedCount = videos.filter(v => v.status === 'failed').length;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/execution-history')}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{workflow?.name || 'Workflow'}</h1>
                        <p className="text-sm text-muted-foreground">
                            Execution #{executionId} • {execution?.status}
                        </p>
                    </div>
                </div>

                {/* Progress Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Total Videos</div>
                        <div className="text-2xl font-bold">{videos.length}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Completed</div>
                        <div className="text-2xl font-bold text-green-500">{completedCount}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Failed</div>
                        <div className="text-2xl font-bold text-red-500">{failedCount}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Progress</div>
                        <div className="text-2xl font-bold">
                            {videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Video Queue */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Video Processing Queue</h2>
                    <div className="space-y-3">
                        {videos.map((video, idx) => (
                            <div
                                key={idx}
                                className={`bg-card border rounded-lg p-4 transition-all ${getStatusColor(video.status)}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Thumbnail */}
                                    {video.thumbnail_url && (
                                        <img
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            className="w-32 h-20 object-cover rounded"
                                        />
                                    )}

                                    {/* Video Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate">{video.title}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Video {idx + 1} of {videos.length}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {video.status === 'completed' && (
                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                )}
                                                {video.status === 'processing' && (
                                                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                                )}
                                                {video.status === 'failed' && (
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Stage Progress */}
                                        <div className="mt-3 grid grid-cols-4 gap-2">
                                            {Object.entries(video.stages).map(([stage, status]) => {
                                                const StageIcon = getStageIcon(stage);
                                                return (
                                                    <div
                                                        key={stage}
                                                        className={`flex items-center gap-2 p-2 rounded border ${status === 'completed'
                                                                ? 'bg-green-500/10 border-green-500/20'
                                                                : status === 'running'
                                                                    ? 'bg-blue-500/10 border-blue-500/20'
                                                                    : 'bg-muted/50 border-border'
                                                            }`}
                                                    >
                                                        <StageIcon className="w-4 h-4 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium truncate">
                                                                {getStageLabel(stage)}
                                                            </div>
                                                        </div>
                                                        {getStatusIcon(status)}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Error Message */}
                                        {video.error && (
                                            <div className="mt-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
                                                Error: {video.error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {videos.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                No videos to display. Waiting for workflow to scan videos...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
