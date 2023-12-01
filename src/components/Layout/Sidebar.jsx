import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Link, Scan, Youtube, Languages, Workflow, HardDrive, Activity, Folder, Video, PlayCircle, Play, Droplet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Link, label: 'Single Downloader', path: '/single' },
    { icon: Scan, label: 'Channel Scanner', path: '/channels' },
    { icon: Folder, label: 'Saved Channels', path: '/saved-channels' },
    { icon: Youtube, label: 'Account Manager', path: '/accounts' },
    { icon: Droplet, label: 'Watermark Maker', path: '/watermark-maker' },
    { icon: Workflow, label: 'Workflows', path: '/workflows' },
    { icon: Play, label: 'Quick Workflow', path: '/pre-workflow' },
    { icon: Droplet, label: 'Quick Workflow 2', path: '/pre-workflow-2' },
    { icon: PlayCircle, label: 'Live Workflows', path: '/live' },
    { icon: Activity, label: 'Execution History', path: '/history' },
];

export function Sidebar() {
    const [storageData, setStorageData] = useState({
        used_gb: 0,
        total_gb: 100,
        usage_percentage: 0
    });

    useEffect(() => {
        const fetchStorageData = async () => {
            try {
                const data = await api.storage.info();
                setStorageData(data);
            } catch (error) {
                console.error('Failed to fetch storage data:', error);
            }
        };

        fetchStorageData();
        const interval = setInterval(fetchStorageData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <aside className="w-64 bg-card border-r border-border h-screen flex flex-col sticky top-0">
            <div className="p-6 border-b border-border">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    VidFlow
                </h1>
                <p className="text-xs text-muted-foreground mt-1">Pro Video Downloader</p>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                        <div className={cn(
                            "ml-auto w-1.5 h-1.5 rounded-full bg-primary opacity-0 transition-opacity",
                            window.location.pathname === item.path && "opacity-100"
                        )} />
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-border">
                <div className="bg-accent/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                        <HardDrive className="w-4 h-4 text-primary" />
                        <span>Storage</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(storageData.usage_percentage, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{storageData.used_gb.toFixed(2)} GB used</span>
                        <span>{storageData.total_gb} GB total</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
