/**
 * DemoPage — Live system demonstration
 * ---------------------------------------
 * Layout (3 columns):
 *   LEFT   — Sender chat panel (fully functional)
 *   CENTRE — Animated system flow diagram + latency metrics
 *   RIGHT  — Receiver chat panel (read-only, shows messages arriving live)
 *
 * How it works:
 *   1. On mount, calls GET /api/demo/session to get tokens for both demo users
 *   2. Opens TWO Socket.io connections — one per user
 *   3. A third "observer" connection joins the demo:room to receive trace events
 *   4. When the sender types and sends, the centre panel animates each stage
 *      in real time as the server emits trace events
 */

import React, {
  useEffect, useRef, useState, useCallback,
}                              from 'react';
import { io as socketIo }      from 'socket.io-client';
import { apiClient }           from '../../api/client';
import type { DemoSession }    from './demo.types';
import type { DemoMessageTrace, DemoStage } from './demo.types';
import styles                  from './DemoPage.module.scss';

// =============================================================================
// Types
// =============================================================================

interface PanelMessage {
  id:        string;
  text:      string;
  senderId:  string;
  createdAt: string;
}

// =============================================================================
// Stage metadata — labels + positions in the flow diagram
// =============================================================================

const STAGE_META: Record<DemoStage, { label: string; color: string }> = {
  client_send:       { label: 'Client send',        color: '#6C63FF' },
  ws_received:       { label: 'WS received',         color: '#6C63FF' },
  permission_check:  { label: 'Permission check',    color: '#F59E0B' },
  db_write:          { label: 'DB write (MongoDB)',  color: '#10B981' },
  queue_check:       { label: 'Queue check',         color: '#F59E0B' },
  ws_broadcast:      { label: 'WS broadcast',        color: '#6C63FF' },
  queue_enqueue:     { label: 'Queue enqueue',       color: '#EF4444' },
  receiver_received: { label: 'Receiver received',   color: '#10B981' },
};

const STAGE_ORDER: DemoStage[] = [
  'client_send',
  'ws_received',
  'permission_check',
  'db_write',
  'queue_check',
  'ws_broadcast',
  'receiver_received',
];

// =============================================================================
// Sub-components
// =============================================================================

/** Animated flow diagram showing which stage is active */
const FlowDiagram: React.FC<{
  activeStages: Set<DemoStage>;
  trace:        DemoMessageTrace | null;
}> = ({ activeStages, trace }) => (
  <div className={styles.flowDiagram}>
    {STAGE_ORDER.map((stage, i) => {
      const meta      = STAGE_META[stage];
      const isActive  = activeStages.has(stage);
      const stageData = trace?.stages.find((s) => s.stage === stage);

      return (
        <React.Fragment key={stage}>
          <div className={`${styles.flowNode} ${isActive ? styles.flowNodeActive : ''}`}
               style={{ '--node-color': meta.color } as React.CSSProperties}>
            <div className={styles.flowNodeDot} />
            <div className={styles.flowNodeLabel}>{meta.label}</div>
            {stageData && (
              <div className={styles.flowNodeTime}>
                +{stageData.durationMs}ms
              </div>
            )}
          </div>
          {i < STAGE_ORDER.length - 1 && (
            <div className={`${styles.flowArrow} ${isActive ? styles.flowArrowActive : ''}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/** Per-message latency breakdown table */
const LatencyBreakdown: React.FC<{ trace: DemoMessageTrace | null }> = ({ trace }) => {
  if (!trace?.stages.length) {
    return (
      <div className={styles.latencyEmpty}>
        Send a message to see latency breakdown
      </div>
    );
  }

  const totalMs = trace.stages[trace.stages.length - 1]?.totalMs ?? 0;

  return (
    <div className={styles.latencyTable}>
      <div className={styles.latencyHeader}>
        <span>Stage</span>
        <span>Duration</span>
        <span>Total</span>
      </div>
      {trace.stages.map((s) => (
        <div key={s.stage} className={styles.latencyRow}>
          <span className={styles.latencyStage}>
            {STAGE_META[s.stage]?.label ?? s.stage}
          </span>
          <span className={styles.latencyDuration}>{s.durationMs}ms</span>
          <span className={styles.latencyTotal}>{s.totalMs}ms</span>
        </div>
      ))}
      <div className={styles.latencyFooter}>
        End-to-end: <strong>{totalMs}ms</strong>
      </div>
    </div>
  );
};

/** A minimal chat panel used for both sender and receiver */
const ChatPanel: React.FC<{
  title:      string;
  userId:     string;
  messages:   PanelMessage[];
  isSender:   boolean;
  inputText:  string;
  isOffline:  boolean;
  onInput:    (v: string) => void;
  onSend:     () => void;
  onKeyDown:  (e: React.KeyboardEvent) => void;
  onToggleOffline?: () => void;
}> = ({
  title, userId, messages, isSender,
  inputText, isOffline, onInput, onSend, onKeyDown, onToggleOffline,
}) => (
  <div className={`${styles.panel} ${isOffline ? styles.panelOffline : ''}`}>
    <div className={styles.panelHeader}>
      <span className={styles.panelTitle}>{title}</span>
      <div className={styles.panelStatus}>
        <span className={`${styles.statusDot} ${isOffline ? styles.offline : styles.online}`} />
        <span>{isOffline ? 'Offline' : 'Online'}</span>
        {onToggleOffline && (
          <button className={styles.toggleBtn} onClick={onToggleOffline}>
            {isOffline ? 'Go online' : 'Go offline'}
          </button>
        )}
      </div>
    </div>

    <div className={styles.panelMessages}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`${styles.panelBubble} ${msg.senderId === userId ? styles.ownBubble : styles.otherBubble}`}
        >
          <div className={styles.bubbleText}>{msg.text}</div>
          <div className={styles.bubbleTime}>
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>

    {isSender && (
      <div className={styles.panelInput}>
        <input
          type="text"
          className={styles.inputField}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isOffline}
        />
        <button
          className={styles.sendBtn}
          onClick={onSend}
          disabled={!inputText.trim() || isOffline}
        >
          Send
        </button>
      </div>
    )}
  </div>
);

// =============================================================================
// Main DemoPage
// =============================================================================

const DemoPage: React.FC = () => {
  const [session,       setSession]       = useState<DemoSession | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [senderMsgs,    setSenderMsgs]    = useState<PanelMessage[]>([]);
  const [receiverMsgs,  setReceiverMsgs]  = useState<PanelMessage[]>([]);
  const [inputText,     setInputText]     = useState('');
  const [activeTrace,   setActiveTrace]   = useState<DemoMessageTrace | null>(null);
  const [activeStages,  setActiveStages]  = useState<Set<DemoStage>>(new Set());
  const [wsEventLog,    setWsEventLog]    = useState<string[]>([]);
  const [receiverOffline, setReceiverOffline] = useState(false);

  const senderSocketRef   = useRef<ReturnType<typeof socketIo> | null>(null);
  const receiverSocketRef = useRef<ReturnType<typeof socketIo> | null>(null);
  const observerSocketRef = useRef<ReturnType<typeof socketIo> | null>(null);

  // ── Load demo session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await apiClient.get<{ data: DemoSession }>('/demo/session');
        setSession(data.data);
      } catch {
        setError('Failed to load demo session. Is the server running?');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // ── Open socket connections once session is loaded ─────────────────────────
  useEffect(() => {
    if (!session) return;

    const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

    /** Helper to create an authenticated socket */
    const connect = (token: string) =>
      socketIo(WS_URL, {
        auth:       { token: `Bearer ${token}` },
        transports: ['websocket'],
      });

    // ── Sender socket ────────────────────────────────────────────────────────
    const senderSocket = connect(session.sender.accessToken);
    senderSocketRef.current = senderSocket;

    senderSocket.on('message:new', (msg: PanelMessage) => {
      setSenderMsgs((prev) => [...prev, msg]);
      logWsEvent(`[Sender] ← message:new (seq ${(msg as unknown as { seq: number }).seq})`);
    });

    senderSocket.on('connect', () => logWsEvent('[Sender] ✓ connected'));
    senderSocket.on('disconnect', () => logWsEvent('[Sender] ✗ disconnected'));

    // ── Receiver socket ──────────────────────────────────────────────────────
    const receiverSocket = connect(session.receiver.accessToken);
    receiverSocketRef.current = receiverSocket;

    receiverSocket.on('message:new', (msg: PanelMessage) => {
      setReceiverMsgs((prev) => [...prev, msg]);
      logWsEvent(`[Receiver] ← message:new (seq ${(msg as unknown as { seq: number }).seq})`);
    });

    receiverSocket.on('connect', () => logWsEvent('[Receiver] ✓ connected'));
    receiverSocket.on('disconnect', () => logWsEvent('[Receiver] ✗ disconnected'));

    // ── Observer socket (for trace events) ───────────────────────────────────
    // Uses sender's token — just needs to be authenticated to join demo:room
    const observerSocket = connect(session.sender.accessToken);
    observerSocketRef.current = observerSocket;

    observerSocket.on('connect', () => {
      observerSocket.emit('demo:join');
      logWsEvent('[Observer] joined demo:room');
    });

    observerSocket.on('demo:trace', (trace: DemoMessageTrace) => {
      setActiveTrace(trace);
      // Animate: show each completed stage
      const completedStages = new Set(trace.stages.map((s) => s.stage));
      setActiveStages(completedStages);
    });

    return () => {
      senderSocket.disconnect();
      receiverSocket.disconnect();
      observerSocket.disconnect();
    };
  }, [session]);

  // ── Log helper ─────────────────────────────────────────────────────────────
  const logWsEvent = useCallback((event: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setWsEventLog((prev) => [`${time}  ${event}`, ...prev].slice(0, 50));
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !session || !senderSocketRef.current) return;

    // Reset trace for this new message
    setActiveTrace(null);
    setActiveStages(new Set(['client_send']));
    logWsEvent(`[Sender] → message:send "${text.slice(0, 30)}"`);

    const clientMsgId = crypto.randomUUID();

    senderSocketRef.current.emit(
      'message:send',
      {
        clientMsgId,
        conversationId: session.conversationId,
        type:           'text',
        content:        { text },
      },
      (ack: { status: string; seq?: number }) => {
        if (ack.status === 'ok') {
          logWsEvent(`[Sender] ✓ ack received (seq ${ack.seq})`);
        } else {
          logWsEvent(`[Sender] ✗ send failed`);
        }
      },
    );

    setInputText('');
  }, [inputText, session, logWsEvent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Toggle receiver offline ────────────────────────────────────────────────
  const toggleReceiverOffline = useCallback(() => {
    const socket = receiverSocketRef.current;
    if (!socket) return;

    if (receiverOffline) {
      socket.connect();
      logWsEvent('[Receiver] → reconnecting...');
    } else {
      socket.disconnect();
      logWsEvent('[Receiver] → going offline (messages will queue)');
    }
    setReceiverOffline((v) => !v);
  }, [receiverOffline, logWsEvent]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className={styles.loading}>Initialising demo session...</div>;
  }

  if (error) {
    return <div className={styles.errorState}>{error}</div>;
  }

  return (
    <div className={styles.demoLayout}>
      {/* ── Left: Sender panel ─────────────────────────────────────────── */}
      <ChatPanel
        title="Sender"
        userId={session!.sender.user.id}
        messages={senderMsgs}
        isSender
        inputText={inputText}
        isOffline={false}
        onInput={setInputText}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
      />

      {/* ── Centre: System diagram + metrics ───────────────────────────── */}
      <div className={styles.centre}>
        <div className={styles.centreHeader}>Live system flow</div>

        {/* Flow diagram */}
        <FlowDiagram activeStages={activeStages} trace={activeTrace} />

        {/* Latency breakdown */}
        <div className={styles.sectionLabel}>Latency breakdown</div>
        <LatencyBreakdown trace={activeTrace} />

        {/* WebSocket event log */}
        <div className={styles.sectionLabel}>WebSocket event stream</div>
        <div className={styles.eventLog}>
          {wsEventLog.length === 0 && (
            <div className={styles.eventLogEmpty}>Events will appear here...</div>
          )}
          {wsEventLog.map((entry, i) => (
            <div key={i} className={styles.eventLogEntry}>{entry}</div>
          ))}
        </div>
      </div>

      {/* ── Right: Receiver panel ──────────────────────────────────────── */}
      <ChatPanel
        title="Receiver"
        userId={session!.receiver.user.id}
        messages={receiverMsgs}
        isSender={false}
        inputText=""
        isOffline={receiverOffline}
        onInput={() => {}}
        onSend={() => {}}
        onKeyDown={() => {}}
        onToggleOffline={toggleReceiverOffline}
      />
    </div>
  );
};

export default DemoPage;