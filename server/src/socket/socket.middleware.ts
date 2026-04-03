// =============================================================================
// socket/socket.middleware.ts
// JWT verification for WebSocket connections.
// Token is sent as a query param: io('...', { auth: { token } })
// =============================================================================

import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.utils';
import { UnauthorizedError } from '../errors/errors';
import * as AuthRepo from '../modules/auth/auth.repository';

/**
 * Authenticates a Socket.io connection.
 * Called before the 'connection' event fires.
 * Attaches userId + displayName to socket.data for use in handlers.
 */
export const socketAuthMiddleware = async (
    socket: Socket,
    next: (err?: Error) => void,
) => {
    try {
        // Token sent via: socket.io-client auth option
        // io(URL, { auth: { token: 'Bearer eyJ...' } })
        const raw = socket.handshake.auth?.token as string | undefined;
        const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;

        if (!token) throw new UnauthorizedError('No token provided');

        const payload = verifyAccessToken(token);
        if (!payload) throw new UnauthorizedError('Invalid token');

        const user = await AuthRepo.findUserById(payload.userId);
        if (!user) throw new UnauthorizedError('User not found');

        // Attach to socket — available in all handlers via socket.data
        socket.data.userId = user.id;
        socket.data.displayName = user.displayName;

        next();
    } catch (err) {
        next(err instanceof Error ? err : new Error('Auth failed'));
    }
};