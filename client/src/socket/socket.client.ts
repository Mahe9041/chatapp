// =============================================================================
// socket/socket.client.ts
// Socket.io client singleton.
// Connect/disconnect controlled by auth state — never connect unauthenticated.
// =============================================================================

import { io, Socket } from 'socket.io-client';
import type {
    ClientToServerEvents,
    ServerToClientEvents
} from '@chatapp/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Creates and connects the Socket.io client.
 * Call this right after a successful login.
 *
 * @param accessToken - JWT access token sent as auth credential
 */
export function connectSocket(accessToken: string): AppSocket {
    if (socket?.connected) return socket;

    socket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:4000', {
        auth: { token: `Bearer ${accessToken}` },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        transports: ['websocket'], // skip long-polling — we know WS works
    }) as AppSocket;

    return socket;
}

/** Disconnects and clears the socket instance. Call on logout. */
export function disconnectSocket(): void {
    socket?.disconnect();
    socket = null;
}

/** Returns the current socket instance (null if not connected) */
export function getSocket(): AppSocket | null {
    return socket;
}