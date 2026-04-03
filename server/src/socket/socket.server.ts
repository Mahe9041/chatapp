/**
 * socket.server.ts — Socket.io server
 * Attaches to the HTTP server, uses Redis adapter for multi-node support.
 * Registers all event handlers per connection.
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'http';  // ← correct import
import { redisPub, redisSub } from '../config/redis';
import { socketAuthMiddleware } from './socket.middleware';
import { registerMessageHandlers } from './handlers/message.handler';
import { registerTypingHandlers } from './handlers/typing.handler';
import { registerPresenceHandlers } from './handlers/presence.handler';
import { registerReadHandlers } from './handlers/read.handler';
import { registerDemoHandlers } from './handlers/demo.handler';
import type {
    ClientToServerEvents,
    ServerToClientEvents
} from '@chatapp/shared';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { env } from '../config/env';

declare module 'socket.io' {
    interface SocketData {
        userId: string;
        displayName: string;
    }
}

export function initSocketServer(httpServer: HttpServer) {
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
            credentials: true,
        },
        pingTimeout: 20000,
        pingInterval: 25000,
    });

    // ── Redis adapter ──────────────────────────────────────────────────────────
    io.adapter(createAdapter(redisPub, redisSub));

    // ── Auth middleware ────────────────────────────────────────────────────────
    io.use(socketAuthMiddleware);

    // ── Connection handler ─────────────────────────────────────────────────────
    io.on('connection', async (socket) => {
        const { userId } = socket.data;
        logger.info({ userId, socketId: socket.id }, 'Socket connected');

        await joinUserRooms(socket, userId);
        await setUserOnline(userId);
        await broadcastPresence(io, userId, true);

        // Feature handlers
        registerMessageHandlers(io, socket);
        registerTypingHandlers(io, socket);
        registerPresenceHandlers(io, socket);
        registerReadHandlers(io, socket);
        registerDemoHandlers(io, socket);   // ← demo mode

        socket.on('disconnect', async (reason) => {
            logger.info({ userId, reason }, 'Socket disconnected');
            await setUserOffline(userId);
            await broadcastPresence(io, userId, false);
        });
    });

    logger.info('Socket.io server initialised');
    return io;
}

// ── Helpers (same as Phase 2) ─────────────────────────────────────────────────

async function joinUserRooms(
    socket: { join: (room: string) => void },
    userId: string,
) {
    const memberships = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
    });
    memberships.forEach(({ conversationId }) => {
        socket.join(`conversation:${conversationId}`);
    });
}

async function setUserOnline(userId: string) {
    await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
    });
}

async function setUserOffline(userId: string) {
    await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
    });
}

async function broadcastPresence(
    io: Server,
    userId: string,
    isOnline: boolean,
) {
    const memberships = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
    });
    const payload = { userId, isOnline, lastSeen: new Date().toISOString() };
    memberships.forEach(({ conversationId }) => {
        io.to(`conversation:${conversationId}`).emit('presence:update', payload);
    });
}

// Exported io reference
export let io: ReturnType<typeof initSocketServer> | null = null;
export function setIo(instance: ReturnType<typeof initSocketServer>) {
    io = instance;
}