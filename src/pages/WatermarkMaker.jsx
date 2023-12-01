import React, { useState, useEffect } from 'react';
import { Droplet, Upload, Download, Loader2, AlertCircle, Check, Palette, Move, Type, Eye, FolderOpen, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export default function WatermarkMaker() {
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    const [config, setConfig] = useState({
        text: '© 2025 My Brand',
        position: 'bottom-right',
        font_size: 24,
        color: 'white',
        opacity: 0.8,
        enable_box: true,
        box_color: 'black',
        box_opacity: 0.5,
        custom_x: null,
        custom_y: null
    });

    const positions = [
        { value: 'top-left', label: 'Top Left' },
        { value: 'top-center', label: 'Top Center' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'center-left', label: 'Center Left' },
        { value: 'center', label: 'Center' },
        { value: 'center-right', label: 'Center Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'bottom-center', label: 'Bottom Center' },
        { value: 'bottom-right', label: 'Bottom Right' }
    ];

    const colors = [
        { value: 'white', label: 'White', hex: '#FFFFFF' },
        { value: 'black', label: 'Black', hex: '#000000' },
        { value: 'red', label: 'Red', hex: '#FF0000' },
        { value: 'blue', label: 'Blue', hex: '#0000FF' },
        { value: 'green', label: 'Green', hex: '#00FF00' },
        { value: 'yellow', label: 'Yellow', hex: '#FFFF00' }
    ];

    // Fetch videos on mount
    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.watermarks.listVideos(50);
            setVideos(data);
        } catch (err) {
            setError('Failed to load videos: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePreview = async () => {
        if (!selectedVideo) {
            setError('Please select a video first');
            return;
        }

        if (!config.text.trim()) {
            setError('Please enter watermark text');
            return;
        }

        setIsGeneratingPreview(true);
        setError(null);

        try {
            const response = await api.watermarks.preview(selectedVideo.id, config);
            if (response.success) {
                setPreviewUrl(`http://localhost:8000${response.preview_url}?t=${Date.now()}`);
            } else {
                setError(response.error_message || 'Failed to generate preview');
            }
        } catch (err) {
            setError('Failed to generate preview: ' + err.message);
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    const handleApplyWatermark = async () => {
        if (!selectedVideo) {
            setError('Please select a video first');
            return;
        }

        if (!config.text.trim()) {
            setError('Please enter watermark text');
            return;
        }

        setIsApplying(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await api.watermarks.apply(selectedVideo.id, config);
            if (response.success) {
                setSuccess('Watermark applied successfully!');
            } else {
                setError(response.error_message || 'Failed to apply watermark');
            }
        } catch (err) {
            setError('Failed to apply watermark: ' + err.message);
        } finally {
            setIsApplying(false);
        }
    };

    const handleDownload = async () => {
        if (!selectedVideo) return;

        try {
            window.open(`http://localhost:8000/api/watermarks/download/${selectedVideo.id}`, '_blank');
        } catch (err) {
            setError('Failed to download: ' + err.message);
        }
    };

    const handleOpenFolder = async () => {
        if (!selectedVideo) return;

        try {
            await api.watermarks.openFolder(selectedVideo.id);
        } catch (err) {
            setError('Failed to open folder: ' + err.message);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Preview Modal */}
            {showPreviewModal && previewUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
                    onClick={() => setShowPreviewModal(false)}
                >
                    <div className="relative max-w-3xl w-full">
                        <button
                            onClick={() => setShowPreviewModal(false)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={previewUrl}
                            alt="Watermark Preview - Enlarged"
                            className="w-full h-auto rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-white text-center mt-4 text-sm opacity-75">Click outside to close</p>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                    <Droplet className="w-8 h-8 text-primary" />
                    Watermark Maker
                </h1>
                <p className="text-muted-foreground">Add custom watermarks to your downloaded videos.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-3 text-green-600 mb-3">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{success}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download Video
                        </button>
                        <button
                            onClick={handleOpenFolder}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Open Folder
                        </button>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Video Selection */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                            Select Video
                        </h2>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : videos.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Upload className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No videos available</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                {videos.map((video) => (
                                    <button
                                        key={video.id}
                                        onClick={() => {
                                            setSelectedVideo(video);
                                            setPreviewUrl(null);
                                            setSuccess(null);
                                        }}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg border transition-all",
                                            selectedVideo?.id === video.id
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:bg-accent"
                                        )}
                                    >
                                        <div className="flex gap-3">
                                            {video.thumbnail_url && (
                                                <img
                                                    src={video.thumbnail_url}
                                                    alt={video.title}
                                                    className="w-20 h-14 object-cover rounded"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-1 capitalize">{video.platform}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle Column: Configuration */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-muted-foreground" />
                            Watermark Configuration
                        </h2>

                        <div className="space-y-4">
                            {/* Text Input */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <Type className="w-4 h-4" />
                                    Watermark Text
                                </label>
                                <input
                                    type="text"
                                    value={config.text}
                                    onChange={(e) => setConfig({ ...config, text: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Enter watermark text..."
                                />
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <Move className="w-4 h-4" />
                                    Position
                                </label>
                                <select
                                    value={config.position}
                                    onChange={(e) => setConfig({ ...config, position: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    {positions.map((pos) => (
                                        <option key={pos.value} value={pos.value}>{pos.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Font Size */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Font Size: {config.font_size}px
                                </label>
                                <input
                                    type="range"
                                    min="12"
                                    max="72"
                                    value={config.font_size}
                                    onChange={(e) => setConfig({ ...config, font_size: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Text Color</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {colors.map((color) => (
                                        <button
                                            key={color.value}
                                            onClick={() => setConfig({ ...config, color: color.value })}
                                            className={cn(
                                                "px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all",
                                                config.color === color.value
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:bg-accent"
                                            )}
                                        >
                                            <div
                                                className="w-4 h-4 rounded border border-border"
                                                style={{ backgroundColor: color.hex }}
                                            />
                                            {color.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Opacity */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Text Opacity: {Math.round(config.opacity * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={config.opacity}
                                    onChange={(e) => setConfig({ ...config, opacity: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Background Box */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.enable_box}
                                        onChange={(e) => setConfig({ ...config, enable_box: e.target.checked })}
                                        className="rounded border-primary text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm font-medium">Enable Background Box</span>
                                </label>
                            </div>

                            {config.enable_box && (
                                <>
                                    {/* Box Color */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Box Color</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {colors.map((color) => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setConfig({ ...config, box_color: color.value })}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all",
                                                        config.box_color === color.value
                                                            ? "border-primary bg-primary/10"
                                                            : "border-border hover:bg-accent"
                                                    )}
                                                >
                                                    <div
                                                        className="w-4 h-4 rounded border border-border"
                                                        style={{ backgroundColor: color.hex }}
                                                    />
                                                    {color.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Box Opacity */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Box Opacity: {Math.round(config.box_opacity * 100)}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={config.box_opacity}
                                            onChange={(e) => setConfig({ ...config, box_opacity: parseFloat(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-4 space-y-2">
                                <button
                                    onClick={handleGeneratePreview}
                                    disabled={!selectedVideo || isGeneratingPreview}
                                    className="w-full bg-secondary text-secondary-foreground px-4 py-3 rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isGeneratingPreview ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-5 h-5" />
                                            Generate Preview
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleApplyWatermark}
                                    disabled={!selectedVideo || isApplying}
                                    className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isApplying ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Applying...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            Apply Watermark
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-muted-foreground" />
                            Preview
                        </h2>

                        <div
                            className={cn(
                                "aspect-video bg-black/5 rounded-lg overflow-hidden border border-border flex items-center justify-center",
                                previewUrl && "cursor-pointer hover:border-primary transition-colors"
                            )}
                            onClick={() => previewUrl && setShowPreviewModal(true)}
                        >
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Watermark Preview"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">Click "Generate Preview" to see watermark</p>
                                </div>
                            )}
                        </div>

                        {previewUrl && (
                            <p className="text-xs text-center text-muted-foreground mt-2">
                                Click preview to enlarge
                            </p>
                        )}

                        {selectedVideo && (
                            <div className="mt-4 p-3 bg-accent/50 rounded-lg">
                                <h3 className="font-medium text-sm mb-1">Selected Video</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{selectedVideo.title}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
