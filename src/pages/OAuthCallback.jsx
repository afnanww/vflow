import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../lib/api';

export default function OAuthCallback() {
    const { platform } = useParams();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('processing'); // processing, success, error
    const [message, setMessage] = useState('Authenticating...');
    const navigate = useNavigate();

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                setStatus('error');
                setMessage(`Authentication failed: ${error}`);
                return;
            }

            if (!code) {
                setStatus('error');
                setMessage('No authorization code received.');
                return;
            }

            try {
                // Send code to backend
                await api.auth.callback(platform, code);

                setStatus('success');
                setMessage('Successfully connected! You can close this window.');

                // Notify parent window
                if (window.opener) {
                    window.opener.postMessage({ type: 'oauth_success', platform }, '*');
                    setTimeout(() => window.close(), 1500);
                } else {
                    // Fallback if not in popup
                    setTimeout(() => navigate('/accounts'), 1500);
                }

            } catch (err) {
                console.error('Callback error:', err);
                setStatus('error');
                setMessage(err.response?.data?.detail || 'Failed to exchange token.');
            }
        };

        processCallback();
    }, [platform, searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 text-center">
            {status === 'processing' && (
                <>
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <h2 className="text-xl font-semibold">Connecting to {platform}...</h2>
                    <p className="text-muted-foreground">Please wait while we complete the setup.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                    <h2 className="text-xl font-semibold">Connected!</h2>
                    <p className="text-muted-foreground">{message}</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <XCircle className="w-12 h-12 text-destructive mb-4" />
                    <h2 className="text-xl font-semibold">Connection Failed</h2>
                    <p className="text-destructive">{message}</p>
                    <button
                        onClick={() => window.close()}
                        className="mt-4 px-4 py-2 bg-secondary rounded-lg text-sm"
                    >
                        Close Window
                    </button>
                </>
            )}
        </div>
    );
}
