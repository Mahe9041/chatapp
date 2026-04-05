// =============================================================================
// store/chat.store.ts
// Zustand store for all chat state.
// Owns: conversations list, messages per conversation, typing state, presence.
// =============================================================================

import { create } from 'zustand';
import * as ConvoApi from '../api/conversations.api';
import * as MessageApi from '../api/messages.api';
import {
    emitSendMessage,
    emitTypingStart,
    emitTypingStop,
    emitReadMark
} from '../socket/socket.events';
import type {
    Conversation,
    Message,
    TypingPayload,
    PresencePayload,
    ReadReceiptPayload,
    EditMessagePayload,
    DeleteMessagePayload,
    ReactPayload
} from '@chatapp/shared';

interface ChatState {
    // ── State ──────────────────────────────────────────────────────────────────
    conversations: Conversation[];
    /** Messages keyed by conversationId */
    messages: Record<string, Message[]>;
    /** Set of userIds currently typing, keyed by conversationId */
    typingUsers: Record<string, Set<string>>;
    activeConvoId: string | null;
    isLoadingConvos: boolean;
    isLoadingMsgs: boolean;

    // ── Conversation actions ───────────────────────────────────────────────────
    loadConversations: () => Promise<void>;
    setActiveConvo: (conversationId: string) => void;
    createDirect: (targetUserId: string) => Promise<Conversation>;
    createGroup: (name: string, memberIds: string[]) => Promise<Conversation>;

    // ── Message actions ────────────────────────────────────────────────────────
    loadMessages: (conversationId: string, before?: number) => Promise<void>;
    sendMessage: (conversationId: string, text: string) => Promise<void>;

    // ── Incoming socket event handlers (called by socket.handlers.ts) ──────────
    receiveMessage: (message: Message) => void;
    handleMessageEdited: (payload: EditMessagePayload) => void;
    handleMessageDeleted: (payload: DeleteMessagePayload) => void;
    handleMessageReaction: (payload: ReactPayload) => void;
    handleTypingStart: (payload: TypingPayload) => void;
    handleTypingStop: (payload: TypingPayload) => void;
    handlePresenceUpdate: (payload: PresencePayload) => void;
    handleReadReceipt: (payload: ReadReceiptPayload) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    messages: {},
    typingUsers: {},
    activeConvoId: null,
    isLoadingConvos: false,
    isLoadingMsgs: false,

    // ── Load all conversations ─────────────────────────────────────────────────
    loadConversations: async () => {
        set({ isLoadingConvos: true });
        try {
            const convos = await ConvoApi.getConversations();
            set({ conversations: convos, isLoadingConvos: false });
        } catch {
            set({ isLoadingConvos: false });
        }
    },

    // ── Set active conversation + load its messages ───────────────────────────
    setActiveConvo: (conversationId) => {
        set({ activeConvoId: conversationId });
        const alreadyLoaded = get().messages[conversationId];
        if (!alreadyLoaded) get().loadMessages(conversationId);
    },

    // ── Load messages (paginated) ─────────────────────────────────────────────
    loadMessages: async (conversationId, before) => {
        set({ isLoadingMsgs: true });
        try {
            const msgs = await MessageApi.getMessages(conversationId, before);
            set((state) => ({
                isLoadingMsgs: false,
                messages: {
                    ...state.messages,
                    [conversationId]: before
                        // Prepend older messages for infinite scroll
                        ? [...msgs, ...(state.messages[conversationId] ?? [])]
                        : msgs,
                },
            }));
        } catch {
            set({ isLoadingMsgs: false });
        }
    },

    // ── Create conversations ──────────────────────────────────────────────────
    createDirect: async (targetUserId) => {
        const convo = await ConvoApi.createDirect(targetUserId);
        set((state) => ({
            conversations: [convo, ...state.conversations],
        }));
        return convo;
    },

    createGroup: async (name, memberIds) => {
        const convo = await ConvoApi.createGroup(name, memberIds);
        set((state) => ({
            conversations: [convo, ...state.conversations],
        }));
        return convo;
    },

    // ── Send a text message via WebSocket ─────────────────────────────────────
    sendMessage: async (conversationId, text) => {
        await emitSendMessage({
            conversationId,
            type: 'text',
            content: { text },
        });
        // The actual message is added to state via receiveMessage()
        // when the server broadcasts message:new back (including to sender)
    },

    // ── Incoming: new message ─────────────────────────────────────────────────
    receiveMessage: (message) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [message.conversationId]: [
                    ...(state.messages[message.conversationId] ?? []),
                    message,
                ],
            },
            // Bump conversation to top of list
            conversations: state.conversations
                .map((c) =>
                    c.id === message.conversationId
                        ? { ...c, lastMessage: message, updatedAt: new Date().toISOString() }
                        : c,
                )
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        }));

        // Auto-mark as read if this conversation is currently active
        if (get().activeConvoId === message.conversationId) {
            emitReadMark(message.conversationId, message.seq);
        }
    },

    // ── Incoming: message edited ──────────────────────────────────────────────
    handleMessageEdited: (payload) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [payload.conversationId]: (state.messages[payload.conversationId] ?? []).map(
                    (m) => m.id === payload.messageId
                        ? { ...m, content: { ...m.content, text: payload.text }, editedAt: new Date().toISOString() }
                        : m,
                ),
            },
        }));
    },

    // ── Incoming: message deleted ─────────────────────────────────────────────
    handleMessageDeleted: (payload) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [payload.conversationId]: (state.messages[payload.conversationId] ?? []).map(
                    (m) => m.id === payload.messageId
                        ? { ...m, deletedAt: new Date().toISOString() }
                        : m,
                ),
            },
        }));
    },

    // ── Incoming: reaction ────────────────────────────────────────────────────
    handleMessageReaction: (payload) => {
        // Reload that conversation's messages to get fresh reactions
        // (simpler than trying to merge reaction state manually)
        get().loadMessages(payload.conversationId);
    },

    // ── Incoming: typing start ────────────────────────────────────────────────
    handleTypingStart: (payload) => {
        set((state) => {
            const current = new Set(state.typingUsers[payload.conversationId] ?? []);
            current.add(payload.userId);
            return { typingUsers: { ...state.typingUsers, [payload.conversationId]: current } };
        });
    },

    // ── Incoming: typing stop ─────────────────────────────────────────────────
    handleTypingStop: (payload) => {
        set((state) => {
            const current = new Set(state.typingUsers[payload.conversationId] ?? []);
            current.delete(payload.userId);
            return { typingUsers: { ...state.typingUsers, [payload.conversationId]: current } };
        });
    },

    // ── Incoming: presence update ─────────────────────────────────────────────
    handlePresenceUpdate: (payload) => {
        set((state) => ({
            conversations: state.conversations.map((c) => ({
                ...c,
                members: c.members.map((m) => {
                    if (m.userId !== payload.userId) return m;
                    if (!m.user) return m;
                    return {
                        ...m,
                        user: {
                            ...m.user,
                            isOnline: payload.isOnline,
                            lastSeen: payload.lastSeen,
                        },
                    };
                }),
            })),
        }));
    },

    // ── Incoming: read receipt ────────────────────────────────────────────────
    handleReadReceipt: (payload) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [payload.conversationId]: (state.messages[payload.conversationId] ?? []).map(
                    (m) => m.seq <= payload.upToSeq
                        ? { ...m, deliveryStatus: { ...m.deliveryStatus, [payload.userId]: 'read' } }
                        : m,
                ),
            },
        }));
    },
}));