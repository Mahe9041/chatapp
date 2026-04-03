// =============================================================================
// socket/handlers/presence.handler.ts
// Presence ping — client sends every 25s to confirm it's alive.
// =============================================================================

import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database';

export function registerPresenceHandlers(io: Server, socket: Socket) {
    const { userId } = socket.data;

    /**
     * Client pings every ~25s to keep the presence state alive.
     * We just update lastSeen — isOnline is already true from connection.
     */
    socket.on('presence:ping', async () => {
        await prisma.user.update({
            where: { id: userId },
            data: { lastSeen: new Date() },
        });
    });
}
