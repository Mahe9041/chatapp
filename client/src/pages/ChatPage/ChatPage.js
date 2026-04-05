import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ChatPage — Complete chat interface
 * Features:
 *  - Conversation list with online indicators + unread counts
 *  - New DM modal with user search
 *  - New Group modal
 *  - Message thread with bubbles, timestamps, read receipts
 *  - Typing indicator
 *  - Real-time updates via WebSocket
 */
import { useState, useEffect, useRef, useCallback, } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chat.store';
import { useAuthStore } from '../../store/auth.store';
import { useMessages } from '../../hooks/useMessages';
import { chatRoute } from '../../constants/routes';
import * as UsersApi from '../../api/users.api';
import styles from './ChatPage.module.scss';
// =============================================================================
// Avatar component
// =============================================================================
const Avatar = ({ name, isOnline, size = 'md' }) => (_jsxs("div", { className: `${styles.avatar} ${styles[`avatar_${size}`]}`, children: [_jsx("span", { children: name?.charAt(0).toUpperCase() }), isOnline !== undefined && (_jsx("span", { className: `${styles.onlineDot} ${isOnline ? styles.online : styles.offline}` }))] }));
// =============================================================================
// New Conversation Modal
// =============================================================================
const NewConversationModal = ({ onClose }) => {
    const [tab, setTab] = useState('dm');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const { createDirect, createGroup } = useChatStore();
    const navigate = useNavigate();
    const searchTimeout = useRef(undefined);
    // Debounced user search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const users = await UsersApi.searchUsers(query);
                setResults(users);
            }
            catch {
                setResults([]);
            }
            finally {
                setIsSearching(false);
            }
        }, 300);
    }, [query]);
    const toggleSelect = (user) => {
        setSelected((prev) => prev.find((u) => u.id === user.id)
            ? prev.filter((u) => u.id !== user.id)
            : tab === 'dm' ? [user] : [...prev, user]);
    };
    const handleCreate = async () => {
        if (!selected.length)
            return;
        setIsCreating(true);
        try {
            let convo;
            if (tab === 'dm') {
                convo = await createDirect(selected[0].id);
            }
            else {
                if (!groupName.trim())
                    return;
                convo = await createGroup(groupName, selected.map((u) => u.id));
            }
            navigate(chatRoute(convo.id));
            onClose();
        }
        catch (err) {
            console.error('Failed to create conversation', err);
        }
        finally {
            setIsCreating(false);
        }
    };
    return (_jsx("div", { className: styles.modalOverlay, onClick: onClose, children: _jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.modalHeader, children: [_jsx("h2", { className: styles.modalTitle, children: "New conversation" }), _jsx("button", { className: styles.modalClose, onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: styles.modalTabs, children: [_jsx("button", { className: `${styles.modalTab} ${tab === 'dm' ? styles.modalTabActive : ''}`, onClick: () => { setTab('dm'); setSelected([]); }, children: "Direct message" }), _jsx("button", { className: `${styles.modalTab} ${tab === 'group' ? styles.modalTabActive : ''}`, onClick: () => { setTab('group'); setSelected([]); }, children: "Group chat" })] }), tab === 'group' && (_jsx("input", { className: styles.modalInput, placeholder: "Group name", value: groupName, onChange: (e) => setGroupName(e.target.value) })), selected.length > 0 && (_jsx("div", { className: styles.selectedPills, children: selected.map((u) => (_jsxs("span", { className: styles.pill, children: [u.displayName, _jsx("button", { onClick: () => toggleSelect(u), children: "\u2715" })] }, u.id))) })), _jsx("input", { className: styles.modalInput, placeholder: "Search by name or email...", value: query, onChange: (e) => setQuery(e.target.value), autoFocus: true }), _jsxs("div", { className: styles.searchResults, children: [isSearching && (_jsx("div", { className: styles.searchHint, children: "Searching..." })), !isSearching && query && results.length === 0 && (_jsx("div", { className: styles.searchHint, children: "No users found" })), !isSearching && !query && (_jsx("div", { className: styles.searchHint, children: "Type to search for users" })), results.map((user) => {
                            const isSelected = !!selected.find((u) => u.id === user.id);
                            return (_jsxs("div", { className: `${styles.searchResult} ${isSelected ? styles.searchResultSelected : ''}`, onClick: () => toggleSelect(user), children: [_jsx(Avatar, { name: user.displayName, isOnline: user.isOnline, size: "sm" }), _jsxs("div", { className: styles.searchResultInfo, children: [_jsx("div", { className: styles.searchResultName, children: user.displayName }), _jsx("div", { className: styles.searchResultEmail, children: user.email })] }), isSelected && _jsx("span", { className: styles.checkmark, children: "\u2713" })] }, user.id));
                        })] }), _jsx("button", { className: styles.createBtn, onClick: handleCreate, disabled: isCreating ||
                        !selected.length ||
                        (tab === 'group' && !groupName.trim()), children: isCreating
                        ? 'Creating...'
                        : tab === 'dm'
                            ? 'Start conversation'
                            : `Create group (${selected.length} member${selected.length !== 1 ? 's' : ''})` })] }) }));
};
// =============================================================================
// Conversation list item
// =============================================================================
const ConvoItem = ({ convo, isActive, currentUserId, onClick }) => {
    const otherMember = convo.type === 'DIRECT'
        ? convo.members?.find((m) => m.userId !== currentUserId)
        : null;
    const name = convo.type === 'GROUP'
        ? convo.name
        : otherMember?.user?.displayName ?? 'Unknown';
    const isOnline = otherMember?.user?.isOnline ?? false;
    const lastMsg = convo.lastMessage?.content?.text ?? '';
    return (_jsxs("div", { className: `${styles.convoItem} ${isActive ? styles.convoItemActive : ''}`, onClick: onClick, children: [_jsx(Avatar, { name: name, isOnline: convo.type === 'DIRECT' ? isOnline : undefined }), _jsxs("div", { className: styles.convoInfo, children: [_jsx("div", { className: styles.convoName, children: name }), lastMsg && _jsx("div", { className: styles.lastMsg, children: lastMsg })] })] }));
};
// =============================================================================
// Message bubble
// =============================================================================
const MessageBubble = ({ message, isOwn }) => {
    if (message.deletedAt) {
        return (_jsx("div", { className: `${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`, children: _jsx("div", { className: `${styles.bubble} ${styles.deletedBubble}`, children: _jsx("em", { children: "Message deleted" }) }) }));
    }
    const readByOthers = Object.entries(message.deliveryStatus ?? {})
        .some(([uid, status]) => uid !== message.senderId && status === 'read');
    return (_jsx("div", { className: `${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`, children: _jsxs("div", { className: `${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`, children: [message.content?.text && (_jsx("p", { className: styles.bubbleText, children: message.content.text })), _jsxs("div", { className: styles.bubbleMeta, children: [message.editedAt && _jsx("span", { className: styles.editedTag, children: "edited" }), _jsx("span", { className: styles.bubbleTime, children: new Date(message.createdAt).toLocaleTimeString([], {
                                hour: '2-digit', minute: '2-digit',
                            }) }), isOwn && (_jsx("span", { className: `${styles.ticks} ${readByOthers ? styles.ticksRead : ''}`, children: readByOthers ? '✓✓' : '✓' }))] })] }) }));
};
// =============================================================================
// Typing indicator
// =============================================================================
const TypingIndicator = ({ names }) => {
    if (!names.length)
        return null;
    return (_jsxs("div", { className: styles.typingWrap, children: [_jsxs("div", { className: styles.typingDots, children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), _jsx("span", { className: styles.typingText, children: names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(', ')} are typing` })] }));
};
// =============================================================================
// Main ChatPage
// =============================================================================
const ChatPage = () => {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const handleLogout = useCallback(() => { logout(); }, [logout]);
    const [showModal, setShowModal] = useState(false);
    const { conversations, activeConvoId, setActiveConvo, typingUsers, } = useChatStore();
    const { messages, isLoading: isLoadingMsgs, inputText, bottomRef, handleInputChange, handleSend, handleKeyDown, } = useMessages(activeConvoId ?? '');
    const isLoadingConvos = useChatStore((s) => s.isLoadingConvos);
    const [showSidebar, setShowSidebar] = useState(!conversationId);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    // Update isMobile on resize
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    // Sync URL param → store once conversations are loaded
    useEffect(() => {
        if (conversationId && !isLoadingConvos) {
            setActiveConvo(conversationId);
            setShowSidebar(false); // mobile: hide sidebar when convo selected
        }
    }, [conversationId, isLoadingConvos, setActiveConvo]);
    const handleSelectConvo = useCallback((id) => {
        setActiveConvo(id);
        setShowSidebar(false); // mobile: switch to chat view
        navigate(chatRoute(id));
    }, [setActiveConvo, navigate]);
    const activeConvo = conversations.find((c) => c.id === activeConvoId);
    // Get display name for active conversation
    const getConvoName = (convo) => {
        if (!convo)
            return '';
        if (convo.type === 'GROUP')
            return convo.name;
        const other = convo.members?.find((m) => m.userId !== user?.id);
        return other?.user?.displayName ?? 'Unknown';
    };
    // Typing users in active conversation (excluding self)
    const typingNames = Array.from(typingUsers[activeConvoId ?? ''] ?? [])
        .filter((id) => id !== user?.id)
        .map((id) => {
        const member = activeConvo?.members?.find((m) => m.userId === id);
        return member?.user?.displayName ?? 'Someone';
    });
    // Online status for DM
    const otherMember = activeConvo?.type === 'DIRECT'
        ? activeConvo.members?.find((m) => m.userId !== user?.id)
        : null;
    const isOtherOnline = otherMember?.user?.isOnline ?? false;
    // Mobile visibility — inline styles bypass all CSS specificity issues
    return (_jsxs("div", { className: styles.layout, children: [_jsxs("aside", { className: styles.sidebar, style: { display: isMobile && !showSidebar ? 'none' : 'flex' }, children: [_jsxs("div", { className: styles.sidebarHeader, children: [_jsx("span", { className: styles.sidebarTitle, children: "Messages" }), _jsx("button", { className: styles.newChatBtn, onClick: () => setShowModal(true), title: "New conversation", children: "\u270F\uFE0F" })] }), _jsxs("div", { className: styles.currentUser, children: [_jsx(Avatar, { name: user?.displayName ?? '?', size: "sm" }), _jsx("span", { className: styles.userName, children: user?.displayName }), _jsx("button", { className: styles.logoutBtn, onClick: handleLogout, children: "Sign out" })] }), _jsxs("div", { className: styles.convoList, children: [isLoadingConvos && _jsx("div", { className: styles.hint, children: "Loading..." }), !isLoadingConvos && conversations.length === 0 && (_jsxs("div", { className: styles.emptyConvos, children: [_jsx("p", { children: "No conversations yet" }), _jsx("button", { className: styles.startBtn, onClick: () => setShowModal(true), children: "Start a conversation" })] })), conversations.map((convo) => (_jsx(ConvoItem, { convo: convo, isActive: convo.id === activeConvoId, currentUserId: user?.id ?? '', onClick: () => handleSelectConvo(convo.id) }, convo.id)))] })] }), _jsx("main", { className: styles.main, style: { display: isMobile && showSidebar ? 'none' : 'flex' }, children: activeConvo ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [_jsxs("div", { className: styles.chatHeader, children: [_jsx("button", { className: styles.backBtn, onClick: () => setShowSidebar(true), children: "\u2190" }), _jsx(Avatar, { name: getConvoName(activeConvo), isOnline: activeConvo.type === 'DIRECT' ? isOtherOnline : undefined }), _jsxs("div", { children: [_jsx("div", { className: styles.chatName, children: getConvoName(activeConvo) }), activeConvo.type === 'DIRECT' && (_jsx("div", { className: styles.chatStatus, children: isOtherOnline ? 'Online' : 'Offline' })), activeConvo.type === 'GROUP' && (_jsxs("div", { className: styles.chatStatus, children: [activeConvo.members?.length, " members"] }))] })] }), _jsxs("div", { className: styles.messageList, children: [isLoadingMsgs && _jsx("div", { className: styles.hint, children: "Loading messages..." }), messages.map((msg) => (_jsx(MessageBubble, { message: msg, isOwn: msg.senderId === user?.id }, msg.id))), _jsx(TypingIndicator, { names: typingNames }), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: styles.inputArea, children: [_jsx("textarea", { className: styles.input, placeholder: "Type a message... (Enter to send, Shift+Enter for newline)", value: inputText, onChange: (e) => handleInputChange(e.target.value), onKeyDown: handleKeyDown, rows: 1 }), _jsx("button", { className: styles.sendBtn, onClick: handleSend, disabled: !inputText.trim(), children: "Send" })] })] })) : (_jsxs("div", { className: styles.emptyMain, children: [_jsx("div", { className: styles.emptyIcon, children: "\uD83D\uDCAC" }), _jsx("div", { className: styles.emptyText, children: "Select a conversation or start a new one" }), _jsx("button", { className: styles.startBtn, onClick: () => setShowModal(true), children: "New conversation" })] })) }), showModal && _jsx(NewConversationModal, { onClose: () => setShowModal(false) })] }));
};
export default ChatPage;
