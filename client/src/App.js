import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * App.tsx — Root component
 * -------------------------
 * Handles routing, auth rehydration, and socket lifecycle.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { connectSocket, disconnectSocket } from './socket/socket.client';
import { registerSocketHandlers } from './socket/socket.handlers';
import { useChatStore } from './store/chat.store';
import { ROUTES } from './constants/routes';
// Pages
import LoginPage from './pages/LoginPage/LoginPage';
import ChatPage from './pages/ChatPage/ChatPage';
import DemoPage from './pages/DemoPage/DemoPage';
/** Redirects unauthenticated users to /login */
function PrivateRoute({ children }) {
    const user = useAuthStore((s) => s.user);
    return user ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: ROUTES.LOGIN, replace: true });
}
export default function App() {
    const { user, accessToken, rehydrate } = useAuthStore();
    const loadConversations = useChatStore((s) => s.loadConversations);
    const setActiveConvo = useChatStore((s) => s.setActiveConvo);
    const [rehydrated, setRehydrated] = useState(false);
    // ── Step 1: Rehydrate session on first load ───────────────────────────────
    useEffect(() => {
        rehydrate().finally(() => setRehydrated(true));
    }, [rehydrate]);
    // ── Step 2: Connect socket + load conversations when authenticated ────────
    useEffect(() => {
        if (!user || !accessToken)
            return;
        const socket = connectSocket(accessToken);
        socket.on('connect', async () => {
            registerSocketHandlers();
            // Load conversations first, THEN sync the URL conversationId
            await loadConversations();
            // If URL has a conversationId (e.g. user refreshed on /chat/:id),
            // set it as active now that conversations are loaded
            const match = window.location.pathname.match(/\/chat\/([^/]+)/);
            if (match?.[1]) {
                setActiveConvo(match[1]);
            }
        });
        return () => {
            disconnectSocket();
        };
    }, [user, accessToken, loadConversations, setActiveConvo]);
    // Don't render routes until rehydration is complete — prevents flash redirect
    if (!rehydrated)
        return null;
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: ROUTES.LOGIN, element: _jsx(LoginPage, {}) }), _jsx(Route, { path: ROUTES.DEMO, element: _jsx(DemoPage, {}) }), _jsx(Route, { path: "/chat/*", element: _jsx(PrivateRoute, { children: _jsx(ChatPage, {}) }) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: ROUTES.CHAT, replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: ROUTES.LOGIN, replace: true }) })] }) }));
}
