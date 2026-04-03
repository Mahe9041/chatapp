// =============================================================================
// demo.types.ts — client-side demo types
// (mirrors server/src/modules/demo/demo.types.ts)
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

export interface DemoSession {
    sender: {
        user: { id: string; email: string; displayName: string };
        accessToken: string;
        refreshToken: string;
    };
    receiver: {
        user: { id: string; email: string; displayName: string };
        accessToken: string;
        refreshToken: string;
    };
    conversationId: string;
}
