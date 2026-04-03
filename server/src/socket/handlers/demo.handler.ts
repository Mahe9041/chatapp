// =============================================================================
// socket/handlers/demo.handler.ts
// Handles demo-specific socket events.
// Demo clients join a special room to receive real-time trace events.
// =============================================================================

import type { Server, Socket } from 'socket.io';
import { DEMO_ROOM } from '../../modules/demo/demo.tracer';
import { logger } from '../../utils/logger';

/**
 * Registers demo mode socket handlers.
 *
 * Demo clients emit 'demo:join' on connect to subscribe to trace events.
 * The server then broadcasts DemoMessageTrace objects to this room
 * after every stage of message processing.
 */
export function registerDemoHandlers(_io: Server, socket: Socket) {
    /** Client joins the demo observer room */
    socket.on('demo:join', () => {
        socket.join(DEMO_ROOM);
        logger.info({ socketId: socket.id }, 'Client joined demo room');
    });

    /** Client leaves the demo observer room */
    socket.on('demo:leave', () => {
        socket.leave(DEMO_ROOM);
    });
}
