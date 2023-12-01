/**
 * Custom React hook for WebSocket connection to download progress
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/api/downloads/progress';
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState({});
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Update progress state
                    setProgress(prev => ({
                        ...prev,
                        [data.download_id]: {
                            downloadId: data.download_id,
                            progress: data.progress,
                            status: data.status,
                            message: data.message,
                            timestamp: Date.now(),
                        }
                    }));
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                // Attempt to reconnect
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    connect();
                }, RECONNECT_DELAY);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Error creating WebSocket:', error);

            // Retry connection
            reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            // Cleanup on unmount
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const getProgress = useCallback((downloadId) => {
        return progress[downloadId] || null;
    }, [progress]);

    const clearProgress = useCallback((downloadId) => {
        setProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[downloadId];
            return newProgress;
        });
    }, []);

    return {
        isConnected,
        progress,
        getProgress,
        clearProgress,
    };
}

export default useWebSocket;
