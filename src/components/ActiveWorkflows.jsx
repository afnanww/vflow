import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle2, AlertCircle, Loader2, Play, StopCircle, Trash2, ChevronDown, ChevronUp, History, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export default function ActiveWorkflows() {
    const navigate = useNavigate();
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchExecutions = async () => {
        try {
            const data = await api.workflows.history();
            // Show running executions AND recent ones (limit to 5 for dashboard)
            setExecutions(data.slice(0, 5));
        } catch (err) {
            console.error("Failed to fetch active workflows:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExecutions();

        // WebSocket connection for real-time updates
        const ws = new WebSocket('ws://localhost:8000/ws/workflow-events');

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'workflow_started' || message.type === 'workflow_completed' || message.type === 'workflow_failed' || message.type === 'log') {
                fetchExecutions();
            }
        };

        // Poll every 5 seconds as backup
        const interval = setInterval(fetchExecutions, 5000);

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, []);

    const handleStop = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to stop this workflow?')) return;
        try {
            await api.workflows.cancel(id);
            fetchExecutions();
        } catch (err) {
            console.error("Failed to stop workflow:", err);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this execution record?')) return;
        try {
            await api.workflows.deleteExecution(id);
            setExecutions(prev => prev.filter(ex => ex.id !== id));
        } catch (err) {
            console.error("Failed to delete execution:", err);
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (loading && executions.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 bg-card border border-border rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (executions.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-border bg-card shadow-sm p-6 mb-8 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Recent Workflows</h3>
                </div>
                <button
                    onClick={() => navigate('/history')}
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <History className="w-4 h-4" />
                    View All History
                </button>
            </div>
            <div className="space-y-4">
                {executions.map((exec) => (
                    <div
                        key={exec.id}
                        className={cn(
                            "rounded-lg border border-border transition-all duration-200 overflow-hidden",
                            exec.status === 'running' ? "bg-accent/50 border-primary/50" : "bg-card hover:bg-accent/20"
                        )}
                    >
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer"
                            onClick={() => toggleExpand(exec.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    exec.status === 'running' ? "bg-primary/10 text-primary" :
                                        exec.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                            exec.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                                "bg-gray-500/10 text-gray-500"
                                )}>
                                    {exec.status === 'running' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                        exec.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                            exec.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                                                <StopCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">Workflow #{exec.workflow_id}</p>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full capitalize",
                                            exec.status === 'running' ? "bg-primary/10 text-primary" :
                                                exec.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                                    exec.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                                        "bg-gray-500/10 text-gray-500"
                                        )}>
                                            {exec.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(exec.started_at).toLocaleString()}</span>
                                        <span className="mx-1">•</span>
                                        {exec.status === 'running' ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/workflows/${exec.workflow_id}/executions/${exec.id}`);
                                                }}
                                                className="flex items-center gap-1 text-primary hover:underline font-medium"
                                            >
                                                View Progress
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/execution/${exec.id}`);
                                                }}
                                                className="flex items-center gap-1 text-primary hover:underline"
                                            >
                                                View Details
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {exec.status === 'running' && (
                                    <button
                                        onClick={(e) => handleStop(exec.id, e)}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Stop Workflow"
                                    >
                                        <StopCircle className="w-5 h-5" />
                                    </button>
                                )}
                                {exec.status !== 'running' && (
                                    <button
                                        onClick={(e) => handleDelete(exec.id, e)}
                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        title="Delete Record"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                                {expandedId === exec.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === exec.id && (
                            <div className="px-4 pb-4 pt-0 border-t border-border/50 bg-accent/5">
                                <div className="mt-4 space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Execution Log</h4>
                                    <div className="bg-background rounded-lg p-3 font-mono text-xs text-muted-foreground max-h-60 overflow-y-auto border border-border">
                                        {exec.execution_log && exec.execution_log.length > 0 ? (
                                            exec.execution_log.map((log, i) => (
                                                <div key={i} className="py-0.5 border-b border-border/50 last:border-0">
                                                    {log}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="italic">No logs available</p>
                                        )}
                                    </div>
                                    {exec.error_message && (
                                        <div className="mt-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                                            <span className="font-bold">Error:</span> {exec.error_message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
