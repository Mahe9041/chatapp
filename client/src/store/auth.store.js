/**
 * Auth Store — Zustand
 * --------------------
 * Manages the entire authentication lifecycle:
 *   - User profile + token state
 *   - Login / register / logout actions
 *   - Token persistence (localStorage) via zustand/middleware persist
 *   - Session rehydration on app load (calls /auth/me to validate stored token)
 *
 * Rules:
 *   - This store owns auth state — no other store duplicates user data
 *   - All auth API calls happen here, not in components or hooks
 *   - Components read from this store via `useAuthStore` selector hooks
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as AuthApi from '../api/auth.api';
// =============================================================================
// Store
// =============================================================================
export const useAuthStore = create()(
/**
 * `persist` middleware saves accessToken + refreshToken to localStorage.
 * On app load, Zustand rehydrates the store and we validate the session
 * by calling /auth/me (see `rehydrate` action).
 *
 * We store only tokens in localStorage — never the user object — to
 * reduce the sensitive data footprint.
 */
persist((set, get) => ({
    // ── Initial state ───────────────────────────────────────────────────────
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
    error: null,
    // ── Register ────────────────────────────────────────────────────────────
    register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const result = await AuthApi.register(payload);
            set({
                user: result.user,
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                isLoading: false,
            });
        }
        catch (err) {
            set({ isLoading: false, error: extractErrorMessage(err) });
            throw err; // Re-throw so the form can react (e.g. highlight field)
        }
    },
    // ── Login ───────────────────────────────────────────────────────────────
    login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const result = await AuthApi.login(payload);
            set({
                user: result.user,
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                isLoading: false,
            });
        }
        catch (err) {
            set({ isLoading: false, error: extractErrorMessage(err) });
            throw err;
        }
    },
    // ── Logout ──────────────────────────────────────────────────────────────
    logout: async () => {
        const { refreshToken } = get();
        // Best-effort server-side revocation — don't block UI on failure
        if (refreshToken) {
            AuthApi.logout(refreshToken).catch(() => { });
        }
        set({ user: null, accessToken: null, refreshToken: null, error: null });
    },
    // ── Rehydrate ───────────────────────────────────────────────────────────
    /**
     * Called once on app startup (in App.tsx useEffect).
     * Validates that the stored access token is still valid.
     * If expired — the axios interceptor will auto-refresh; if that fails,
     * this will catch and clear the session cleanly.
     */
    rehydrate: async () => {
        const { accessToken } = get();
        if (!accessToken)
            return; // No session to restore
        set({ isLoading: true });
        try {
            const user = await AuthApi.getMe();
            set({ user: user, isLoading: false });
        }
        catch {
            // Token invalid and refresh failed — clear stale state
            set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
        }
    },
    // ── setTokens ───────────────────────────────────────────────────────────
    setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
    },
    // ── clearError ──────────────────────────────────────────────────────────
    clearError: () => set({ error: null }),
}), {
    name: 'chatapp-auth', // localStorage key
    storage: createJSONStorage(() => localStorage),
    // Only persist tokens — user object is re-fetched on rehydrate
    partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
    }),
}));
// =============================================================================
// Selector hooks
// RULE: every selector must return a PRIMITIVE or a STABLE reference.
// Never return a new object literal — it causes infinite re-render loops.
// =============================================================================
/** Returns true if the user is logged in */
export const useIsAuthenticated = () => useAuthStore((s) => !!s.user);
/** Returns the current user or null */
export const useCurrentUser = () => useAuthStore((s) => s.user);
/** Returns loading state — primitive boolean, safe to use directly */
export const useAuthIsLoading = () => useAuthStore((s) => s.isLoading);
/** Returns error string — primitive, safe to use directly */
export const useAuthError = () => useAuthStore((s) => s.error);
// NOTE: useAuthStatus is intentionally removed.
// Returning { isLoading, error } from a selector creates a new object every
// render which Zustand sees as a change → triggers re-render → infinite loop.
// Use useAuthIsLoading() and useAuthError() separately in components.
// =============================================================================
// Helpers
// =============================================================================
function extractErrorMessage(err) {
    if (err && typeof err === 'object' && 'response' in err) {
        const response = err.response;
        return response?.data?.error?.message ?? 'Something went wrong';
    }
    return 'Something went wrong';
}
