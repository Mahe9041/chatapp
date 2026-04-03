/**
 * socket.types.ts — WebSocket event contract
 * --------------------------------------------
 * Every Socket.io event payload typed on both FE and BE.
 * Changing a payload here causes TypeScript errors on both sides simultaneously.
 */

import type { Message, DeliveryStatus } from './domain.types';

// =============================================================================
// Demo types (duplicated here from demo.types so shared package is self-contained)
// =============================================================================

export type DemoStage =
    | 'client_send'
    | 'ws_received'
    | 'permission_check'
    | 'db_write'
    | 'queue_check'
    | 'ws_broadcast'
    | 'queue_enqueue'
    | 'receiver_received';

export interface DemoLatencyEvent {
    stage: DemoStage;
    timestamp: number;
    durationMs: number;
    totalMs: number;
    meta?: Record<string, unknown>;
}

export interface DemoMessageTrace {
    traceId: string;
    conversationId: string;
    stages: DemoLatencyEvent[];
    isComplete: boolean;
}

// =============================================================================
// Client → Server events
// =============================================================================

export interface ClientToServerEvents {
    // ── Messaging ──────────────────────────────────────────────────────────────
    'message:send': (payload: SendMessagePayload, ack: MessageAck) => void;
    'message:edit': (payload: EditMessagePayload) => void;
    'message:delete': (payload: DeleteMessagePayload) => void;
    'message:react': (payload: ReactPayload) => void;

    // ── Typing ─────────────────────────────────────────────────────────────────
    'typing:start': (payload: TypingPayload) => void;
    'typing:stop': (payload: TypingPayload) => void;

    // ── Presence ───────────────────────────────────────────────────────────────
    'presence:ping': () => void;

    // ── Read receipts ──────────────────────────────────────────────────────────
    'read:mark': (payload: ReadMarkPayload) => void;

    // ── Demo mode ──────────────────────────────────────────────────────────────
    'demo:join': () => void;
    'demo:leave': () => void;
}

// =============================================================================
// Server → Client events
// =============================================================================

export interface ServerToClientEvents {
    // ── Messaging ──────────────────────────────────────────────────────────────
    'message:new': (message: Message) => void;
    'message:edited': (payload: EditMessagePayload) => void;
    'message:deleted': (payload: DeleteMessagePayload) => void;
    'message:reaction': (payload: ReactPayload) => void;

    // ── Typing ─────────────────────────────────────────────────────────────────
    'typing:start': (payload: TypingPayload) => void;
    'typing:stop': (payload: TypingPayload) => void;

    // ── Presence ───────────────────────────────────────────────────────────────
    'presence:update': (payload: PresencePayload) => void;

    // ── Read receipts ──────────────────────────────────────────────────────────
    'read:receipt': (payload: ReadReceiptPayload) => void;

    // ── Errors ─────────────────────────────────────────────────────────────────
    'error:permission_denied': (payload: ErrorPayload) => void;

    // ── Demo mode ──────────────────────────────────────────────────────────────
    'demo:trace': (trace: DemoMessageTrace) => void;
}

// =============================================================================
// Payload shapes
// =============================================================================

export interface SendMessagePayload {
    clientMsgId: string;
    conversationId: string;
    type: Message['type'];
    content: Message['content'];
    replyTo?: string;
}

export interface MessageAck {
    (response:
        | { status: 'ok'; seq: number; serverId: string }
        | { status: 'error'; code: string }
    ): void;
}

export interface TypingPayload {
    conversationId: string;
    userId: string;
}

export interface PresencePayload {
    userId: string;
    isOnline: boolean;
    lastSeen: string;
}

export interface ReadMarkPayload {
    conversationId: string;
    upToSeq: number;
}

export interface ReadReceiptPayload {
    conversationId: string;
    userId: string;
    upToSeq: number;
    status: DeliveryStatus;
}

export interface EditMessagePayload {
    messageId: string;
    conversationId: string;
    text: string;
}

export interface DeleteMessagePayload {
    messageId: string;
    conversationId: string;
}

export interface ReactPayload {
    messageId: string;
    conversationId: string;
    emoji: string;
}

export interface ErrorPayload {
    code: string;
    message: string;
}