// =============================================================================
// api/auth.api.ts
// All HTTP calls related to authentication.
// Returns typed responses — no `any` escape hatches.
// =============================================================================

import { apiClient } from './client';
import type { AuthResponse, AuthTokens } from '@chatapp/shared';

export interface RegisterPayload {
    email: string;
    password: string;
    displayName: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

/**
 * Creates a new account.
 * Returns user profile + token pair on success.
 */
export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>('/auth/register', payload);
    return data.data;
};

/**
 * Authenticates an existing user.
 * Returns user profile + token pair on success.
 */
export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<{ data: AuthResponse }>('/auth/login', payload);
    return data.data;
};

/**
 * Exchanges a refresh token for a new access + refresh token pair.
 * Called automatically by the axios interceptor — rarely called directly.
 */
export const refresh = async (refreshToken: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<{ data: AuthTokens }>('/auth/refresh', { refreshToken });
    return data.data;
};

/**
 * Revokes the current refresh token (server-side logout).
 */
export const logout = async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refreshToken });
};

/**
 * Returns the currently authenticated user's profile.
 * Requires valid access token (attached automatically by interceptor).
 */
export const getMe = async (): Promise<AuthResponse['user']> => {
    const { data } = await apiClient.get<{ data: AuthResponse['user'] }>('/auth/me');
    return data.data;
};