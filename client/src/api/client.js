// =============================================================================
// api/client.ts
// Axios singleton — the ONLY place that creates HTTP requests.
// No component or hook ever calls fetch() or axios() directly.
//
// Features:
//  - Injects Authorization header on every request automatically
//  - Intercepts 401s and attempts silent token refresh
//  - On refresh failure → clears auth state + redirects to login
// =============================================================================
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
// ── Base instance ─────────────────────────────────────────────────────────────
export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});
// ── Request interceptor — attach access token ─────────────────────────────────
apiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));
// ── Response interceptor — silent token refresh on 401 ───────────────────────
let isRefreshing = false;
let refreshQueue = [];
/**
 * When multiple requests fail with 401 simultaneously, we only want ONE
 * refresh call. The others queue here and resolve once the refresh completes.
 */
function subscribeToRefresh(callback) {
    refreshQueue.push(callback);
}
function drainRefreshQueue(newToken) {
    refreshQueue.forEach((cb) => cb(newToken));
    refreshQueue = [];
}
apiClient.interceptors.response.use(
// Pass through successful responses untouched
(response) => response, async (error) => {
    const originalRequest = error.config;
    // Only attempt refresh on 401, and only once per request (_retry flag)
    if (error.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
    }
    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
        return new Promise((resolve) => {
            subscribeToRefresh((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                resolve(apiClient(originalRequest));
            });
        });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken)
            throw new Error('No refresh token');
        // Call refresh endpoint directly (not through apiClient to avoid loop)
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data.data;
        // Update store with new tokens
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);
        // Drain queue — resolve all waiting requests with new token
        drainRefreshQueue(accessToken);
        // Retry the original failed request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
    }
    catch {
        // Refresh failed — session is dead, force logout
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
    }
    finally {
        isRefreshing = false;
    }
});
