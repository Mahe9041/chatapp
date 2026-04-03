import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import React, { useEffect, useRef, useState, useCallback, } from 'react';
import { io as socketIo } from 'socket.io-client';
import { apiClient } from '../../api/client';
import styles from './DemoPage.module.scss';
// =============================================================================
// Stage metadata — labels + positions in the flow diagram
// =============================================================================
const STAGE_META = {
    client_send: { label: 'Client send', color: '#6C63FF' },
    ws_received: { label: 'WS received', color: '#6C63FF' },
    permission_check: { label: 'Permission check', color: '#F59E0B' },
    db_write: { label: 'DB write (MongoDB)', color: '#10B981' },
    queue_check: { label: 'Queue check', color: '#F59E0B' },
    ws_broadcast: { label: 'WS broadcast', color: '#6C63FF' },
    queue_enqueue: { label: 'Queue enqueue', color: '#EF4444' },
    receiver_received: { label: 'Receiver received', color: '#10B981' },
};
const STAGE_ORDER = [
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
const FlowDiagram = ({ activeStages, trace }) => (_jsx("div", { className: styles.flowDiagram, children: STAGE_ORDER.map((stage, i) => {
        const meta = STAGE_META[stage];
        const isActive = activeStages.has(stage);
        const stageData = trace?.stages.find((s) => s.stage === stage);
        return (_jsxs(React.Fragment, { children: [_jsxs("div", { className: `${styles.flowNode} ${isActive ? styles.flowNodeActive : ''}`, style: { '--node-color': meta.color }, children: [_jsx("div", { className: styles.flowNodeDot }), _jsx("div", { className: styles.flowNodeLabel, children: meta.label }), stageData && (_jsxs("div", { className: styles.flowNodeTime, children: ["+", stageData.durationMs, "ms"] }))] }), i < STAGE_ORDER.length - 1 && (_jsx("div", { className: `${styles.flowArrow} ${isActive ? styles.flowArrowActive : ''}` }))] }, stage));
    }) }));
/** Per-message latency breakdown table */
const LatencyBreakdown = ({ trace }) => {
    if (!trace?.stages.length) {
        return (_jsx("div", { className: styles.latencyEmpty, children: "Send a message to see latency breakdown" }));
    }
    const totalMs = trace.stages[trace.stages.length - 1]?.totalMs ?? 0;
    return (_jsxs("div", { className: styles.latencyTable, children: [_jsxs("div", { className: styles.latencyHeader, children: [_jsx("span", { children: "Stage" }), _jsx("span", { children: "Duration" }), _jsx("span", { children: "Total" })] }), trace.stages.map((s) => (_jsxs("div", { className: styles.latencyRow, children: [_jsx("span", { className: styles.latencyStage, children: STAGE_META[s.stage]?.label ?? s.stage }), _jsxs("span", { className: styles.latencyDuration, children: [s.durationMs, "ms"] }), _jsxs("span", { className: styles.latencyTotal, children: [s.totalMs, "ms"] })] }, s.stage))), _jsxs("div", { className: styles.latencyFooter, children: ["End-to-end: ", _jsxs("strong", { children: [totalMs, "ms"] })] })] }));
};
/** A minimal chat panel used for both sender and receiver */
const ChatPanel = ({ title, userId, messages, isSender, inputText, isOffline, onInput, onSend, onKeyDown, onToggleOffline, }) => (_jsxs("div", { className: `${styles.panel} ${isOffline ? styles.panelOffline : ''}`, children: [_jsxs("div", { className: styles.panelHeader, children: [_jsx("span", { className: styles.panelTitle, children: title }), _jsxs("div", { className: styles.panelStatus, children: [_jsx("span", { className: `${styles.statusDot} ${isOffline ? styles.offline : styles.online}` }), _jsx("span", { children: isOffline ? 'Offline' : 'Online' }), onToggleOffline && (_jsx("button", { className: styles.toggleBtn, onClick: onToggleOffline, children: isOffline ? 'Go online' : 'Go offline' }))] })] }), _jsx("div", { className: styles.panelMessages, children: messages.map((msg) => (_jsxs("div", { className: `${styles.panelBubble} ${msg.senderId === userId ? styles.ownBubble : styles.otherBubble}`, children: [_jsx("div", { className: styles.bubbleText, children: msg.text }), _jsx("div", { className: styles.bubbleTime, children: new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                        }) })] }, msg.id))) }), isSender && (_jsxs("div", { className: styles.panelInput, children: [_jsx("input", { type: "text", className: styles.inputField, placeholder: "Type a message...", value: inputText, onChange: (e) => onInput(e.target.value), onKeyDown: onKeyDown, disabled: isOffline }), _jsx("button", { className: styles.sendBtn, onClick: onSend, disabled: !inputText.trim() || isOffline, children: "Send" })] }))] }));
// =============================================================================
// Main DemoPage
// =============================================================================
const DemoPage = () => {
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [senderMsgs, setSenderMsgs] = useState([]);
    const [receiverMsgs, setReceiverMsgs] = useState([]);
    const [inputText, setInputText] = useState('');
    const [activeTrace, setActiveTrace] = useState(null);
    const [activeStages, setActiveStages] = useState(new Set());
    const [wsEventLog, setWsEventLog] = useState([]);
    const [receiverOffline, setReceiverOffline] = useState(false);
    const senderSocketRef = useRef(null);
    const receiverSocketRef = useRef(null);
    const observerSocketRef = useRef(null);
    // ── Load demo session on mount ─────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const { data } = await apiClient.get('/demo/session');
                setSession(data.data);
            }
            catch {
                setError('Failed to load demo session. Is the server running?');
            }
            finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);
    // ── Open socket connections once session is loaded ─────────────────────────
    useEffect(() => {
        if (!session)
            return;
        const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';
        /** Helper to create an authenticated socket */
        const connect = (token) => socketIo(WS_URL, {
            auth: { token: `Bearer ${token}` },
            transports: ['websocket'],
        });
        // ── Sender socket ────────────────────────────────────────────────────────
        const senderSocket = connect(session.sender.accessToken);
        senderSocketRef.current = senderSocket;
        senderSocket.on('message:new', (msg) => {
            setSenderMsgs((prev) => [...prev, msg]);
            logWsEvent(`[Sender] ← message:new (seq ${msg.seq})`);
        });
        senderSocket.on('connect', () => logWsEvent('[Sender] ✓ connected'));
        senderSocket.on('disconnect', () => logWsEvent('[Sender] ✗ disconnected'));
        // ── Receiver socket ──────────────────────────────────────────────────────
        const receiverSocket = connect(session.receiver.accessToken);
        receiverSocketRef.current = receiverSocket;
        receiverSocket.on('message:new', (msg) => {
            setReceiverMsgs((prev) => [...prev, msg]);
            logWsEvent(`[Receiver] ← message:new (seq ${msg.seq})`);
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
        observerSocket.on('demo:trace', (trace) => {
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
    const logWsEvent = useCallback((event) => {
        const time = new Date().toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        setWsEventLog((prev) => [`${time}  ${event}`, ...prev].slice(0, 50));
    }, []);
    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        const text = inputText.trim();
        if (!text || !session || !senderSocketRef.current)
            return;
        // Reset trace for this new message
        setActiveTrace(null);
        setActiveStages(new Set(['client_send']));
        logWsEvent(`[Sender] → message:send "${text.slice(0, 30)}"`);
        const clientMsgId = crypto.randomUUID();
        senderSocketRef.current.emit('message:send', {
            clientMsgId,
            conversationId: session.conversationId,
            type: 'text',
            content: { text },
        }, (ack) => {
            if (ack.status === 'ok') {
                logWsEvent(`[Sender] ✓ ack received (seq ${ack.seq})`);
            }
            else {
                logWsEvent(`[Sender] ✗ send failed`);
            }
        });
        setInputText('');
    }, [inputText, session, logWsEvent]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    // ── Toggle receiver offline ────────────────────────────────────────────────
    const toggleReceiverOffline = useCallback(() => {
        const socket = receiverSocketRef.current;
        if (!socket)
            return;
        if (receiverOffline) {
            socket.connect();
            logWsEvent('[Receiver] → reconnecting...');
        }
        else {
            socket.disconnect();
            logWsEvent('[Receiver] → going offline (messages will queue)');
        }
        setReceiverOffline((v) => !v);
    }, [receiverOffline, logWsEvent]);
    // ── Render ─────────────────────────────────────────────────────────────────
    if (isLoading) {
        return _jsx("div", { className: styles.loading, children: "Initialising demo session..." });
    }
    if (error) {
        return _jsx("div", { className: styles.errorState, children: error });
    }
    return (_jsxs("div", { className: styles.demoLayout, children: [_jsx(ChatPanel, { title: "Sender", userId: session.sender.user.id, messages: senderMsgs, isSender: true, inputText: inputText, isOffline: false, onInput: setInputText, onSend: handleSend, onKeyDown: handleKeyDown }), _jsxs("div", { className: styles.centre, children: [_jsx("div", { className: styles.centreHeader, children: "Live system flow" }), _jsx(FlowDiagram, { activeStages: activeStages, trace: activeTrace }), _jsx("div", { className: styles.sectionLabel, children: "Latency breakdown" }), _jsx(LatencyBreakdown, { trace: activeTrace }), _jsx("div", { className: styles.sectionLabel, children: "WebSocket event stream" }), _jsxs("div", { className: styles.eventLog, children: [wsEventLog.length === 0 && (_jsx("div", { className: styles.eventLogEmpty, children: "Events will appear here..." })), wsEventLog.map((entry, i) => (_jsx("div", { className: styles.eventLogEntry, children: entry }, i)))] })] }), _jsx(ChatPanel, { title: "Receiver", userId: session.receiver.user.id, messages: receiverMsgs, isSender: false, inputText: "", isOffline: receiverOffline, onInput: () => { }, onSend: () => { }, onKeyDown: () => { }, onToggleOffline: toggleReceiverOffline })] }));
};
export default DemoPage;
