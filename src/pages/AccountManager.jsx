import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, ExternalLink, CheckCircle2, AlertCircle, Youtube, Video, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

const PlatformIcon = ({ platform, className }) => {
    switch (platform) {
        case 'youtube': return <Youtube className={cn("text-red-600", className)} />;
        case 'tiktok': return <Video className={cn("text-black dark:text-white", className)} />;
        case 'douyin': return <Video className={cn("text-black dark:text-white", className)} />;
        default: return null;
    }
};

export default function AccountManager() {
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newAccountUrl, setNewAccountUrl] = useState('');
    const [newAccountUsername, setNewAccountUsername] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('youtube');
    const [credentials, setCredentials] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, accountId: null, accountName: '' });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setIsLoading(true);
            const data = await api.accounts.list();
            setAccounts(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
            setError('Failed to load accounts. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthLogin = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            // 1. Get OAuth URL from backend
            // 1. Get OAuth URL from backend
            const response = await api.auth.authorize(selectedPlatform);
            const { auth_url } = response;

            if (!auth_url || auth_url === '#') {
                throw new Error('OAuth configuration missing or platform not supported yet');
            }

            // 2. Open popup
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                auth_url,
                `Connect ${selectedPlatform}`,
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // 3. Poll for popup closure or listen for message (simplified for now)
            // In a real app, the callback page would postMessage back to this window
            // For this demo, we'll assume the user completes the flow and we refresh

            // Note: Since we can't easily capture the callback in this architecture without a dedicated callback page,
            // we will rely on the user closing the popup or manual refresh for now, 
            // OR we can implement a listener if we add a callback route in the frontend.

            // Let's implement a simple message listener
            const messageHandler = async (event) => {
                if (event.data?.type === 'oauth_success') {
                    popup.close();
                    window.removeEventListener('message', messageHandler);
                    await fetchAccounts();
                    setIsAdding(false);
                    setIsSubmitting(false);
                }
            };

            window.addEventListener('message', messageHandler);

        } catch (err) {
            console.error('OAuth error:', err);
            setError(err.response?.data?.detail || err.message || 'Failed to initiate login');
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        const account = accounts.find(acc => acc.id === id);
        setDeleteConfirm({ show: true, accountId: id, accountName: account?.username || 'this account' });
    };

    const confirmDelete = async () => {
        const id = deleteConfirm.accountId;
        setDeleteConfirm({ show: false, accountId: null, accountName: '' });

        try {
            setError(null);
            setIsLoading(true);

            // Delete the account
            await api.accounts.delete(id);

            // Fetch and set fresh data directly
            const freshData = await api.accounts.list();
            setAccounts(freshData);

        } catch (err) {
            console.error('Failed to delete account:', err);
            setError(err.response?.data?.detail || 'Failed to unlink account.');
        } finally {
            setIsLoading(false);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, accountId: null, accountName: '' });
    };

    const handleSync = async (id) => {
        try {
            setError(null);
            await api.accounts.sync(id);
            // Refresh accounts to show updated sync time and profile data
            await fetchAccounts();
        } catch (err) {
            console.error('Failed to sync account:', err);
            setError(err.response?.data?.detail || 'Failed to sync account.');
        }
    };

    if (isLoading && accounts.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Account Manager</h1>
                    <p className="text-muted-foreground mt-1">Manage your linked accounts for YouTube, TikTok, and Douyin.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Account</span>
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {isAdding && (
                <div className="mb-8 p-6 bg-card border border-border rounded-xl shadow-sm animate-in slide-in-from-top-2">
                    <h3 className="font-medium mb-4">Link New Account</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            {['youtube', 'tiktok'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPlatform(p)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors capitalize",
                                        selectedPlatform === p ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-accent"
                                    )}
                                >
                                    <PlatformIcon platform={p} className="w-4 h-4" />
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-accent/30 rounded-lg border border-border text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-background rounded-full flex items-center justify-center border border-border">
                                <PlatformIcon platform={selectedPlatform} className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-medium">Connect {selectedPlatform === 'youtube' ? 'YouTube' : 'TikTok'} Account</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    You will be redirected to {selectedPlatform === 'youtube' ? 'Google' : 'TikTok'} to authorize this application.
                                </p>
                            </div>

                            <button
                                onClick={handleOAuthLogin}
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                Connect with {selectedPlatform === 'youtube' ? 'YouTube' : 'TikTok'}
                            </button>

                            <p className="text-xs text-muted-foreground mt-4">
                                By connecting, you allow VidFlow to upload videos to your channel.
                            </p>
                        </div>

                        <div className="flex justify-end gap-4 mt-2">
                            <button
                                onClick={() => setIsAdding(false)}
                                className="px-6 py-2 bg-accent text-muted-foreground rounded-lg font-medium hover:bg-accent/80 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {accounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-dashed">
                        <p>No accounts linked yet. Click "Add Account" to get started.</p>
                    </div>
                ) : (
                    accounts.map((account) => (
                        <div key={account.id} className="flex items-center gap-6 p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="relative">
                                <img
                                    src={account.avatar_url || `https://ui-avatars.com/api/?name=${account.username}&background=random`}
                                    alt={account.username}
                                    className="w-16 h-16 rounded-full object-cover"
                                />
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center",
                                    account.is_active ? "bg-green-500 text-white" : "bg-gray-500 text-white"
                                )}>
                                    {account.is_active ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                </div>
                                <div className="absolute -top-1 -left-1 bg-card rounded-full p-1 border border-border">
                                    <PlatformIcon platform={account.platform} className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold">{account.username}</h3>
                                    {account.profile_url && (
                                        <a href={account.profile_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="capitalize">{account.platform}</span>
                                    <span>•</span>
                                    <span>{account.subscribers || '0'} subscribers</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3" />
                                        Synced {account.last_sync ? new Date(account.last_sync).toLocaleString() : 'Never'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSync(account.id)}
                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Sync Account"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(account.id)}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                    title="Unlink Account"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>


            {/* Delete Confirmation Modal */}
            {
                deleteConfirm.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-md p-6 bg-card border border-border rounded-xl shadow-lg animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-6 h-6 text-destructive" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Unlink Account</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Are you sure you want to unlink <span className="font-medium text-foreground">{deleteConfirm.accountName}</span>?
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 mb-6 text-sm bg-accent/50 rounded-lg border border-border text-muted-foreground">
                                This will remove the account from VidFlow. You can link it again at any time.
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={cancelDelete}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Unlink Account
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
