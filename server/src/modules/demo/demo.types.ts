// =============================================================================
// demo.types.ts
// Shared types for the demo mode event pipeline.
// =============================================================================

export type DemoStage =
    | 'client_send'        // sender hits send
    | 'ws_received'        // server WebSocket received the event
    | 'permission_check'   // role / membership verified
    | 'db_write'           // message persisted to MongoDB
    | 'queue_check'        // checking which recipients are offline
    | 'ws_broadcast'       // broadcasting to online members
    | 'queue_enqueue'      // offline members — job enqueued
    | 'receiver_received'; // receiver's client got the message

export interface DemoLatencyEvent {
    stage: DemoStage;
    timestamp: number;     // ms since epoch
    durationMs: number;     // time since previous stage
    totalMs: number;     // time since client_send
    meta?: Record<string, unknown>; // e.g. { seqNumber, recipientCount }
}

export interface DemoMessageTrace {
    traceId: string;   // = clientMsgId
    conversationId: string;
    stages: DemoLatencyEvent[];
    isComplete: boolean;
}

// Socket event name the demo panel subscribes to
export const DEMO_EVENT = 'demo:trace' as const;
