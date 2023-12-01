import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Youtube, Upload, ArrowRight, Loader2, AlertCircle, Droplet } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function PreWorkflow2() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [formData, setFormData] = useState({
        url: '',
        accountId: '',
        videoLimit: '5',
        downloadSubtitles: true,
        subtitleLanguage: 'en',
        watermarkText: ''
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const data = await api.accounts.list();
            setAccounts(data.filter(acc => acc.is_active));
            if (data.length > 0) {
                setFormData(prev => ({ ...prev, accountId: data[0].id }));
            }
        } catch (err) {
            console.error("Failed to fetch accounts:", err);
            setError("Failed to load accounts. Please try again.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!formData.url) throw new Error("Please enter a channel URL");
            if (!formData.accountId) throw new Error("Please select an upload account");
            if (!formData.watermarkText.trim()) throw new Error("Please enter watermark text");

            // Construct the workflow payload
            const workflowData = {
                name: `Quick Workflow 2 - ${new Date().toLocaleString()}`,
                description: `Auto-generated workflow: Scan ${formData.url} -> Download ${formData.downloadSubtitles ? 'with subs' : 'no subs'} -> Burn Watermark -> Upload`,
                workflow_data: {
                    nodes: [
                        {
                            id: "scan_1",
                            type: "scan",
                            position: { x: 100, y: 100 },
                            data: {
                                label: "Scan Channel",
                                config: {
                                    url: formData.url,
                                    video_limit: formData.videoLimit
                                }
                            }
                        },
                        {
                            id: "download_1",
                            type: "download",
                            position: { x: 100, y: 250 },
                            data: {
                                label: "Download Video",
                                config: {
                                    download_subtitles: formData.downloadSubtitles,
                                    subtitle_language: formData.subtitleLanguage
                                }
                            }
                        },
                        {
                            id: "burn_1",
                            type: "burn",
                            position: { x: 100, y: 400 },
                            data: {
                                label: "Burn Watermark",
                                config: {
                                    add_watermark: true,
                                    watermark_text: formData.watermarkText
                                }
                            }
                        },
                        {
                            id: "upload_1",
                            type: "upload",
                            position: { x: 100, y: 550 },
                            data: {
                                label: "Upload Video",
                                config: {
                                    platform: accounts.find(a => a.id == formData.accountId)?.platform || "youtube",
                                    account: formData.accountId
                                }
                            }
                        }
                    ],
                    edges: [
                        { id: "e1-2", source: "scan_1", target: "download_1" },
                        { id: "e2-3", source: "download_1", target: "burn_1" },
                        { id: "e3-4", source: "burn_1", target: "upload_1" }
                    ]
                }
            };

            // 1. Create Workflow
            const workflow = await api.workflows.create(workflowData);

            // 2. Execute Workflow
            const execution = await api.workflows.execute(workflow.id);

            // 3. Redirect to details
            navigate(`/execution/${execution.id}`);

        } catch (err) {
            console.error("Workflow creation failed:", err);
            setError(err.message || "Failed to start workflow");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Quick Workflow 2
                </h1>
                <p className="text-muted-foreground">
                    Scan a channel, download videos with optional subtitles, burn watermark, and upload to your account.
                </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Scan */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</div>
                            Scan Channel
                        </div>

                        <div className="pl-10 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Channel URL</label>
                                <input
                                    type="url"
                                    placeholder="https://www.youtube.com/@channel"
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Video Limit</label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.videoLimit}
                                    onChange={(e) => setFormData({ ...formData, videoLimit: e.target.value })}
                                >
                                    <option value="1">1 Video</option>
                                    <option value="5">5 Videos</option>
                                    <option value="10">10 Videos</option>
                                    <option value="all">All Videos</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pl-4 border-l-2 border-border ml-4 h-8" />

                    {/* Step 2: Download */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</div>
                            Download Configuration
                        </div>

                        <div className="pl-10 space-y-4">
                            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                                <span className="text-sm font-medium">Download Subtitles</span>
                                <input
                                    type="checkbox"
                                    checked={formData.downloadSubtitles}
                                    onChange={(e) => setFormData({ ...formData, downloadSubtitles: e.target.checked })}
                                    className="w-4 h-4"
                                />
                            </div>

                            {formData.downloadSubtitles && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Subtitle Language</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={formData.subtitleLanguage}
                                        onChange={(e) => setFormData({ ...formData, subtitleLanguage: e.target.value })}
                                    >
                                        <option value="en">English</option>
                                        <option value="zh">Chinese</option>
                                        <option value="es">Spanish</option>
                                        <option value="id">Indonesian</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pl-4 border-l-2 border-border ml-4 h-8" />

                    {/* Step 3: Watermark */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">3</div>
                            Watermark Settings
                        </div>

                        <div className="pl-10">
                            <label className="block text-sm font-medium mb-1">Watermark Text</label>
                            <input
                                type="text"
                                placeholder="e.g. My Channel Name"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.watermarkText}
                                onChange={(e) => setFormData({ ...formData, watermarkText: e.target.value })}
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                This text will be burned into the top-left corner of each video
                            </p>
                        </div>
                    </div>

                    <div className="pl-4 border-l-2 border-border ml-4 h-8" />

                    {/* Step 4: Upload */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">4</div>
                            Upload Target
                        </div>

                        <div className="pl-10">
                            <label className="block text-sm font-medium mb-1">Select Account</label>
                            {accounts.length > 0 ? (
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.accountId}
                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                    required
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.username} ({acc.platform})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-sm text-destructive">
                                    No active accounts found. Please add an account first.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={loading || accounts.length === 0}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Starting Workflow...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Start Quick Workflow 2
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
