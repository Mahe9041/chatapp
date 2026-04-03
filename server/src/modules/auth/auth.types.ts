// =============================================================================
// auth.types.ts
// Module-local types for auth service responses.
// =============================================================================

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
    };
    tokens: AuthTokens;
}
