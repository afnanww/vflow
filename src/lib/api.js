/**
 * Centralized API client for backend communication
 */

const API_BASE_URL = 'http://localhost:8000';
// const API_BASE_URL = ''; // Proxy

class APIClient {
    constructor(baseURL = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const timeout = options.timeout || 10000; // Default 10 second timeout

        const config = {
            cache: 'no-store',
            headers: {
                // 'Content-Type': 'application/json', // Don't set default here, let fetch handle it for FormData
                ...options.headers,
            },
            ...options,
        };

        // Auto-set Content-Type to application/json if body is JSON string
        // But if it's FormData, browser sets it with boundary automatically
        if (config.body && typeof config.body === 'string' && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }

        const maxRetries = options.retries || 0;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                // Create abort controller for timeout
                // const controller = new AbortController();
                // const timeoutId = setTimeout(() => controller.abort(), timeout);
                // config.signal = controller.signal;

                console.log(`[API] Fetching ${url}...`);
                console.log(`[API] Config:`, config);
                const response = await fetch(url, config);
                console.log(`[API] Fetch completed for ${url}, status: ${response.status}`);
                // clearTimeout(timeoutId);

                if (!response.ok) {
                    // Don't retry on 4xx errors (client errors)
                    if (response.status >= 400 && response.status < 500) {
                        const error = await response.json().catch(() => ({ detail: response.statusText }));
                        throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
                    }
                    // Throw to trigger retry for 5xx errors
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Check if response is JSON
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    console.log(`[API] Parsing JSON for ${url}...`);
                    const data = await response.json();
                    console.log(`[API] JSON parsed for ${url}`);
                    return data;
                } else {
                    return await response.blob(); // Handle file downloads
                }
            } catch (error) {
                console.error(`[API] Error for ${url}:`, error);
                attempt++;
                const isTimeout = error.name === 'AbortError';
                const errorMessage = isTimeout ? `Request timeout after ${timeout}ms` : error.message;

                if (attempt > maxRetries) {
                    if (isTimeout) {
                        console.error(`API Timeout [${endpoint}]: ${errorMessage}`);
                    } else {
                        console.error(`API Error [${endpoint}]:`, error);
                    }
                    throw error;
                }

                console.warn(`API Retry ${attempt}/${maxRetries} [${endpoint}]: ${errorMessage}`);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
    }

    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}, options = {}) {
        const isFormData = data instanceof FormData;
        return this.request(endpoint, {
            method: 'POST',
            body: isFormData ? data : JSON.stringify(data),
            ...options
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

const client = new APIClient();

export const api = {
    downloads: {
        single: (url, options = {}) => client.post('/api/downloads/single', { url, options }),
        status: (id) => client.get(`/api/downloads/${id}`),
        cancel: (id) => client.delete(`/api/downloads/${id}`),
        scan: (url, maxVideos = 50) => client.post(`/api/downloads/channel/scan?url=${encodeURIComponent(url)}&max_videos=${maxVideos}`, {}, { timeout: 120000 }),
        bulk: (videoUrls, options = {}) => client.post('/api/downloads/bulk', { video_urls: videoUrls, options }),
        info: (url) => client.get(`/api/downloads/info?url=${encodeURIComponent(url)}`),
        play: (id) => client.post(`/api/downloads/${id}/play`),
        openFolder: (id) => client.post(`/api/downloads/${id}/open-folder`),
        getAllVideos: (skip = 0, limit = 100) => client.get(`/api/downloads/videos/all?skip=${skip}&limit=${limit}`),
    },
    dashboard: {
        stats: () => client.get('/api/dashboard/stats'),
        activity: (limit = 10) => client.get(`/api/dashboard/activity?limit=${limit}`),
        channels: () => client.get('/api/dashboard/channels'),
    },
    channels: {
        list: () => client.get('/api/channels'),
        get: (id) => client.get(`/api/channels/${id}`),
        delete: (id) => client.delete(`/api/channels/${id}`),
        sync: (id) => client.post(`/api/channels/${id}/sync`, {}, { timeout: 120000 }),
    },
    accounts: {
        list: () => client.get('/api/accounts'),
        create: (data) => client.post('/api/accounts', data),
        delete: (id) => client.delete(`/api/accounts/${id}`),
        sync: (id) => client.post(`/api/accounts/${id}/sync`),
    },
    auth: {
        authorize: (platform) => client.get(`/api/auth/${platform}/authorize`),
        callback: (platform, code) => client.post(`/api/auth/${platform}/callback`, { code }),
    },

    workflows: {
        list: () => client.get('/api/workflows'),
        create: (data) => client.post('/api/workflows', data),
        update: (id, data) => client.put(`/api/workflows/${id}`, data),
        delete: (id) => client.delete(`/api/workflows/${id}`),
        execute: (id) => client.post(`/api/workflows/${id}/execute`),
        history: () => client.get('/api/workflows/history/all'),
        getExecutions: (id) => client.get(`/api/workflows/${id}/executions`),
        getExecutionDetails: (executionId) => client.get(`/api/workflows/execution/${executionId}`),
        cancel: (id) => client.post(`/api/workflows/execution/${id}/cancel`),
        deleteExecution: (id) => client.delete(`/api/workflows/execution/${id}`),
    },
    watermarks: {
        listVideos: (limit = 50) => client.get(`/api/watermarks/videos?limit=${limit}`),
        apply: (videoId, config) => client.post('/api/watermarks/apply', { video_id: videoId, config }),
        preview: (videoId, config, timestamp = "00:00:01") => client.post('/api/watermarks/preview', { video_id: videoId, config, timestamp }),
        download: (videoId) => client.post(`/api/watermarks/download/${videoId}`),
        openFolder: (videoId) => client.post(`/api/watermarks/open-folder/${videoId}`),
    },
    storage: {
        info: () => client.get('/api/storage'),
        clean: () => client.post('/api/storage/clean'),
    }
};

export default api;
