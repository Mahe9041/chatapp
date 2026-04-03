import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// App.tsx
// Root component: routing, auth rehydration, socket lifecycle.
// =============================================================================
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { connectSocket, disconnectSocket } from './socket/socket.client';
import { registerSocketHandlers } from './socket/socket.handlers';
import { useChatStore } from './store/chat.store';
import { ROUTES } from './constants/routes';
// Pages — lazy load to keep initial bundle small
import LoginPage from './pages/LoginPage/LoginPage';
import ChatPage from './pages/ChatPage/ChatPage';
/**
 * Wrapper that redirects unauthenticated users to /login.
 */
function PrivateRoute({ children }) {
    const user = useAuthStore((s) => s.user);
    return user ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: ROUTES.LOGIN, replace: true });
}
/**
 * Root application component.
 * Handles:
 *  1. Session rehydration on app load
 *  2. Socket connection lifecycle (connect on login, disconnect on logout)
 *  3. Route definitions
 */
export default function App() {
    const { user, accessToken, rehydrate } = useAuthStore();
    const loadConversations = useChatStore((s) => s.loadConversations);
    // ── Rehydrate session on app load ─────────────────────────────────────────
    useEffect(() => {
        rehydrate();
    }, [rehydrate]);
    // ── Socket lifecycle — connect when authenticated ─────────────────────────
    useEffect(() => {
        if (user && accessToken) {
            const socket = connectSocket(accessToken);
            // Wait for connection before registering handlers
            socket.on('connect', () => {
                registerSocketHandlers();
                loadConversations();
            });
            return () => {
                disconnectSocket();
            };
        }
    }, [user, accessToken, loadConversations]);
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: ROUTES.LOGIN, element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/chat/*", element: _jsx(PrivateRoute, { children: _jsx(ChatPage, {}) }) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: ROUTES.CHAT, replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: ROUTES.LOGIN, replace: true }) })] }) }));
}
