import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Loader2, PlayCircle, Clock, CheckCircle2, Plus } from 'lucide-react';
import api from '../lib/api';

export default function LiveWorkflows() {
    const navigate = useNavigate();
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchExecutions = async () => {
        try {
            const data = await api.workflows.history();
            // Filter only running executions
            const running = data.filter(exec => exec.status === 'running');
            setExecutions(running);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch executions:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExecutions();
        const interval = setInterval(fetchExecutions, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-red-500 mb-2">Error Loading Workflows</h3>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <Activity className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Live Workflows</h1>
                            <p className="text-sm text-muted-foreground">
                                Currently running workflow executions
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/workflows')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Workflow
                    </button>
                </div>

                {/* Running Executions */}
                {executions.length > 0 ? (
                    <div className="grid gap-4">
                        {executions.map((exec) => (
                            <div
                                key={exec.id}
                                onClick={() => navigate(`/workflows/${exec.workflow_id}/executions/${exec.id}`)}
                                className="bg-card border border-primary/50 rounded-lg p-6 cursor-pointer hover:bg-accent/50 transition-all hover:shadow-lg"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-lg font-semibold">
                                                    Workflow #{exec.workflow_id}
                                                </h3>
                                                <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                                                    Running
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>Started {new Date(exec.started_at).toLocaleString()}</span>
                                                </div>
                                                {exec.execution_results?.processed_count !== undefined && (
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        <span>
                                                            {exec.execution_results.processed_count} / {exec.execution_results.scanned_videos_count || 0} videos
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {exec.execution_log && exec.execution_log.length > 0 && (
                                                <div className="mt-3 p-3 bg-background rounded border border-border">
                                                    <p className="text-xs font-mono text-muted-foreground">
                                                        {exec.execution_log[exec.execution_log.length - 1]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/workflows/${exec.workflow_id}/executions/${exec.id}`);
                                        }}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                        View Progress
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-lg">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <Activity className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Executions Running</h3>
                        <p className="text-muted-foreground mb-6">
                            Create a workflow and run it to see live progress here
                        </p>
                        <button
                            onClick={() => navigate('/workflows')}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Go Make One
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
