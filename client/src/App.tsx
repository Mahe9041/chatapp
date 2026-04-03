// =============================================================================
// App.tsx
// Root component: routing, auth rehydration, socket lifecycle.
// =============================================================================

import { useEffect }              from 'react';
import { BrowserRouter, Routes,
         Route, Navigate }        from 'react-router-dom';
import { useAuthStore }           from './store/auth.store';
import { connectSocket,
         disconnectSocket }       from './socket/socket.client';
import { registerSocketHandlers } from './socket/socket.handlers';
import { useChatStore }           from './store/chat.store';
import { ROUTES }                 from './constants/routes';

// Pages — lazy load to keep initial bundle small
import LoginPage    from './pages/LoginPage/LoginPage';
import ChatPage     from './pages/ChatPage/ChatPage';

/**
 * Wrapper that redirects unauthenticated users to /login.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return user ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />;
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        <Route
          path="/chat/*"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={ROUTES.CHAT} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
}