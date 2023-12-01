import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger", // danger, warning, info
    isLoading = false
}) {
    if (!isOpen) return null;

    const variants = {
        danger: {
            icon: AlertTriangle,
            iconColor: "text-destructive",
            iconBg: "bg-destructive/10",
            buttonBg: "bg-destructive hover:bg-destructive/90",
            buttonText: "text-destructive-foreground"
        },
        warning: {
            icon: AlertTriangle,
            iconColor: "text-yellow-500",
            iconBg: "bg-yellow-500/10",
            buttonBg: "bg-yellow-500 hover:bg-yellow-600",
            buttonText: "text-white"
        },
        info: {
            icon: AlertTriangle, // Could change to Info icon
            iconColor: "text-blue-500",
            iconBg: "bg-blue-500/10",
            buttonBg: "bg-blue-500 hover:bg-blue-600",
            buttonText: "text-white"
        }
    };

    const currentVariant = variants[variant] || variants.danger;
    const Icon = currentVariant.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                    <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-full", currentVariant.iconBg)}>
                            <Icon className={cn("w-6 h-6", currentVariant.iconColor)} />
                        </div>
                        <h3 className="text-xl font-semibold">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-muted-foreground leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                            currentVariant.buttonBg,
                            currentVariant.buttonText,
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {isLoading ? "Processing..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
