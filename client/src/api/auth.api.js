// =============================================================================
// api/auth.api.ts
// All HTTP calls related to authentication.
// Returns typed responses — no `any` escape hatches.
// =============================================================================
import { apiClient } from './client';
/**
 * Creates a new account.
 * Returns user profile + token pair on success.
 */
export const register = async (payload) => {
    const { data } = await apiClient.post('/auth/register', payload);
    return data.data;
};
/**
 * Authenticates an existing user.
 * Returns user profile + token pair on success.
 */
export const login = async (payload) => {
    const { data } = await apiClient.post('/auth/login', payload);
    return data.data;
};
/**
 * Exchanges a refresh token for a new access + refresh token pair.
 * Called automatically by the axios interceptor — rarely called directly.
 */
export const refresh = async (refreshToken) => {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    return data.data;
};
/**
 * Revokes the current refresh token (server-side logout).
 */
export const logout = async (refreshToken) => {
    await apiClient.post('/auth/logout', { refreshToken });
};
/**
 * Returns the currently authenticated user's profile.
 * Requires valid access token (attached automatically by interceptor).
 */
export const getMe = async () => {
    const { data } = await apiClient.get('/auth/me');
    return data.data;
};
