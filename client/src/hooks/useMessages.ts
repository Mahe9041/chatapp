// =============================================================================
// hooks/useMessages.ts
// Hook for message state + input handling in a conversation.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../store/chat.store';
import {
    emitTypingStart,
    emitTypingStop
} from '../socket/socket.events';

/**
 * Manages all message interaction for a single conversation:
 *  - Message list + loading state
 *  - Text input with typing indicator emission
 *  - Send handler
 *  - Auto-scroll to bottom on new messages
 */
export function useMessages(conversationId: string) {
    const { messages, isLoadingMsgs, sendMessage, loadMessages } = useChatStore();
    const [inputText, setInputText] = useState('');
    const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const convoMessages = messages[conversationId] ?? [];

    // Load messages whenever conversationId changes OR when we have an id but no messages
    useEffect(() => {
        if (!conversationId) return;
        // Always reload on conversationId change — handles refresh case
        loadMessages(conversationId);
    }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [convoMessages.length]);

    /** Handles input change + typing indicator logic */
    const handleInputChange = useCallback((value: string) => {
        setInputText(value);

        if (value && !isTypingRef.current) {
            isTypingRef.current = true;
            emitTypingStart(conversationId);
        }

        // Debounce typing:stop — emit 1.5s after the user stops typing
        clearTimeout(typingRef.current ?? undefined);
        typingRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                isTypingRef.current = false;
                emitTypingStop(conversationId);
            }
        }, 1500);
    }, [conversationId]);

    /** Sends the message and clears input */
    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text) return;

        setInputText('');
        isTypingRef.current = false;
        clearTimeout(typingRef.current ?? undefined);
        emitTypingStop(conversationId);

        await sendMessage(conversationId, text);
    }, [inputText, conversationId, sendMessage]);

    /** Send on Enter key (Shift+Enter = newline) */
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return {
        messages: convoMessages,
        isLoading: isLoadingMsgs,
        inputText,
        bottomRef,
        handleInputChange,
        handleSend,
        handleKeyDown,
    };
}