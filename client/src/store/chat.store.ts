// =============================================================================
// store/chat.store.ts
// =============================================================================

import { create } from 'zustand';
import * as ConvoApi from '../api/conversations.api';
import * as MessageApi from '../api/messages.api';
import {
    emitSendMessage,
    emitReadMark,
} from '../socket/socket.events';
import type {
    Conversation,
    Message,
    TypingPayload,
    PresencePayload,
    ReadReceiptPayload,
    EditMessagePayload,
    DeleteMessagePayload,
    ReactPayload,
} from '@chatapp/shared';

interface ChatState {
    conversations: Conversation[];
    messages: Record<string, Message[]>;
    typingUsers: Record<string, Set<string>>;
    activeConvoId: string | null;
    isLoadingConvos: boolean;
    isLoadingMsgs: boolean;

    loadConversations: () => Promise<void>;
    setActiveConvo: (conversationId: string) => void;
    loadMessages: (conversationId: string, before?: number) => Promise<void>;
    createDirect: (targetUserId: string) => Promise<Conversation>;
    createGroup: (name: string, memberIds: string[]) => Promise<Conversation>;
    sendMessage: (conversationId: string, text: string) => Promise<void>;

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

    loadConversations: async () => {
        set({ isLoadingConvos: true });
        try {
            const convos = await ConvoApi.getConversations();
            set({ conversations: convos, isLoadingConvos: false });
        } catch {
            set({ isLoadingConvos: false });
        }
    },

    setActiveConvo: (conversationId) => {
        set({ activeConvoId: conversationId });
        if (!get().messages[conversationId]) {
            get().loadMessages(conversationId);
        }
    },

    loadMessages: async (conversationId, before) => {
        set({ isLoadingMsgs: true });
        try {
            const msgs = await MessageApi.getMessages(conversationId, before);
            set((state) => ({
                isLoadingMsgs: false,
                messages: {
                    ...state.messages,
                    [conversationId]: before
                        ? [...msgs, ...(state.messages[conversationId] ?? [])]
                        : msgs,
                },
            }));
        } catch {
            set({ isLoadingMsgs: false });
        }
    },

    createDirect: async (targetUserId) => {
        const convo = await ConvoApi.createDirect(targetUserId);
        set((state) => ({ conversations: [convo, ...state.conversations] }));
        return convo;
    },

    createGroup: async (name, memberIds) => {
        const convo = await ConvoApi.createGroup(name, memberIds);
        set((state) => ({ conversations: [convo, ...state.conversations] }));
        return convo;
    },

    sendMessage: async (conversationId, text) => {
        await emitSendMessage({
            conversationId,
            type: 'text',
            content: { text },
        });
    },

    receiveMessage: (message) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [message.conversationId]: [
                    ...(state.messages[message.conversationId] ?? []),
                    message,
                ],
            },
            conversations: state.conversations
                .map((c) =>
                    c.id === message.conversationId
                        ? { ...c, lastMessage: message, updatedAt: new Date().toISOString() }
                        : c,
                )
                .sort((a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
                ),
        }));
        if (get().activeConvoId === message.conversationId) {
            emitReadMark(message.conversationId, message.seq);
        }
    },

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

    handleMessageReaction: (payload) => {
        get().loadMessages(payload.conversationId);
    },

    handleTypingStart: (payload) => {
        set((state) => {
            const cur = new Set(state.typingUsers[payload.conversationId] ?? []);
            cur.add(payload.userId);
            return { typingUsers: { ...state.typingUsers, [payload.conversationId]: cur } };
        });
    },

    handleTypingStop: (payload) => {
        set((state) => {
            const cur = new Set(state.typingUsers[payload.conversationId] ?? []);
            cur.delete(payload.userId);
            return { typingUsers: { ...state.typingUsers, [payload.conversationId]: cur } };
        });
    },

    /**
     * Updates the isOnline + lastSeen fields on a specific member's user object.
     * We must reconstruct the user shape correctly — spreading the member itself
     * would give wrong fields (member has userId/role, not id/email/displayName).
     */
    handlePresenceUpdate: (payload) => {
        set((state) => ({
            conversations: state.conversations.map((c) => ({
                ...c,
                members: c.members.map((m) => {
                    if (m.userId !== payload.userId) return m;
                    return {
                        ...m,
                        user: m.user
                            ? { ...m.user, isOnline: payload.isOnline, lastSeen: payload.lastSeen }
                            : undefined,
                    };
                }),
            })),
        }));
    },

    handleReadReceipt: (payload) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [payload.conversationId]: (state.messages[payload.conversationId] ?? []).map(
                    (m) => m.seq <= payload.upToSeq
                        ? { ...m, deliveryStatus: { ...m.deliveryStatus, [payload.userId]: 'read' as const } }
                        : m,
                ),
            },
        }));
    },
}));