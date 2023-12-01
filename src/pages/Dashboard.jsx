import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Download, Activity, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

import ActiveWorkflows from '../components/ActiveWorkflows';

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDashboardData = async () => {
        try {
            const [statsData, activityData] = await Promise.all([
                api.dashboard.stats(),
                api.dashboard.activity(10)
            ]);

            setStats(statsData);
            setActivity(activityData);
            setError(null);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        const interval = setInterval(fetchDashboardData, 5000);

        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">Failed to load dashboard: {error}</p>
                </div>
            </div>
        );
    }

    const statsCards = [
        {
            label: 'Total Downloads',
            value: stats?.total_downloads || 0,
            change: `${stats?.total_videos || 0} videos`,
            icon: Download,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Storage Used',
            value: `${stats?.storage_used_gb || 0} GB`,
            change: `${Math.round((stats?.storage_used_gb / stats?.storage_total_gb) * 100) || 0}% of ${stats?.storage_total_gb || 100} GB`,
            icon: HardDrive,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
        },
        {
            label: 'Active Tasks',
            value: stats?.active_tasks || 0,
            change: `${stats?.total_channels || 0} channels tracked`,
            icon: Activity,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
        },
    ];

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Overview of your download activities and system status.</p>
            </div>

            <ActiveWorkflows />

            <div className="grid gap-4 md:grid-cols-3">
                {statsCards.map((stat) => (
                    <div key={stat.label} className="p-6 rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                <h2 className="text-3xl font-bold mt-2">{stat.value}</h2>
                            </div>
                            <div className={cn("p-3 rounded-full", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">{stat.change}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {activity.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                        ) : (
                            activity.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center",
                                            item.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                                item.status === 'downloading' || item.status === 'processing' ? "bg-blue-500/10 text-blue-500" :
                                                    "bg-red-500/10 text-red-500"
                                        )}>
                                            {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                                item.status === 'downloading' || item.status === 'processing' ? <Download className="w-5 h-5" /> :
                                                    <AlertCircle className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{item.title}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="capitalize">{item.platform}</span>
                                                <span>•</span>
                                                <span>{item.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                            <Clock className="w-3 h-3" />
                                            {item.time}
                                        </p>
                                        {(item.status === 'downloading' || item.status === 'processing') && item.progress !== null && (
                                            <div className="w-24 h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress}%` }} />
                                            </div>
                                        )}
                                        {item.status === 'failed' && item.error && (
                                            <p className="text-xs text-red-500 mt-1">{item.error}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => navigate('/download')}
                            className="p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all text-left group"
                        >
                            <Download className="w-6 h-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
                            <p className="font-medium">New Download</p>
                            <p className="text-xs text-muted-foreground mt-1">Paste a link to start</p>
                        </button>
                        <button
                            onClick={() => navigate('/channels')}
                            className="p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all text-left group"
                        >
                            <Activity className="w-6 h-6 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
                            <p className="font-medium">Scan Channel</p>
                            <p className="text-xs text-muted-foreground mt-1">Analyze a new channel</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
