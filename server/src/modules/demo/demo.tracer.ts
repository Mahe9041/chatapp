// =============================================================================
// demo.tracer.ts
// Lightweight in-process tracer.
// Records timestamps at each stage of message processing and emits
// a trace event to the demo Socket.io room after each stage completes.
// =============================================================================

import { logger } from '../../utils/logger';
import type { DemoLatencyEvent, DemoMessageTrace, DemoStage } from './demo.types';
import { DEMO_EVENT } from './demo.types';

// Lazy io import to avoid circular dependency
let getIo: (() => import('socket.io').Server | null) | null = null;
export function setDemoIoGetter(fn: () => import('socket.io').Server | null) {
    getIo = fn;
}

/** Demo room — all demo clients join this room to receive trace events */
export const DEMO_ROOM = 'demo:room';

/**
 * Creates a new message tracer for a single message send operation.
 * Call `tracer.stage(name)` at each processing step.
 * The tracer emits a Socket.io event after every stage so the frontend
 * can animate the system diagram in real time.
 *
 * @param traceId       - The clientMsgId (unique per message)
 * @param conversationId
 */
export function createMessageTracer(
    traceId: string,
    conversationId: string,
) {
    const startTime = Date.now();
    let prevTime = startTime;

    const trace: DemoMessageTrace = {
        traceId,
        conversationId,
        stages: [],
        isComplete: false,
    };

    /**
     * Records a stage completion and emits the updated trace to demo clients.
     * @param stage - Which stage just completed
     * @param meta  - Optional metadata to attach (seq number, counts, etc.)
     */
    const recordStage = (stage: DemoStage, meta?: Record<string, unknown>) => {
        const now = Date.now();
        const durationMs = now - prevTime;
        const totalMs = now - startTime;
        prevTime = now;

        const event: DemoLatencyEvent = {
            stage,
            timestamp: now,
            durationMs,
            totalMs,
            meta,
        };

        trace.stages.push(event);
        logger.debug({ traceId, stage, durationMs, totalMs }, 'Demo trace stage');

        // Emit to demo room after every stage
        const io = getIo?.();
        if (io) {
            io.to(DEMO_ROOM).emit(DEMO_EVENT, { ...trace });
        }
    };

    const complete = (meta?: Record<string, unknown>) => {
        recordStage('receiver_received', meta);
        trace.isComplete = true;
        const io = getIo?.();
        if (io) {
            io.to(DEMO_ROOM).emit(DEMO_EVENT, { ...trace });
        }
    };

    return { recordStage, complete, trace };
}