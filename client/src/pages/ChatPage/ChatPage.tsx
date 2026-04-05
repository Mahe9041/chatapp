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

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore }           from '../../store/chat.store';
import { useAuthStore }           from '../../store/auth.store';
import { useMessages }            from '../../hooks/useMessages';
import { chatRoute }              from '../../constants/routes';
import * as UsersApi              from '../../api/users.api';
import * as ConvoApi              from '../../api/conversations.api';
import type { UserProfile }       from '../../api/users.api';
import styles                     from './ChatPage.module.scss';

// =============================================================================
// Avatar component
// =============================================================================

const Avatar: React.FC<{
  name:     string;
  isOnline?: boolean;
  size?:    'sm' | 'md' | 'lg';
}> = ({ name, isOnline, size = 'md' }) => (
  <div className={`${styles.avatar} ${styles[`avatar_${size}`]}`}>
    <span>{name?.charAt(0).toUpperCase()}</span>
    {isOnline !== undefined && (
      <span className={`${styles.onlineDot} ${isOnline ? styles.online : styles.offline}`} />
    )}
  </div>
);

// =============================================================================
// New Conversation Modal
// =============================================================================

const NewConversationModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [tab,         setTab]         = useState<'dm' | 'group'>('dm');
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<UserProfile[]>([]);
  const [selected,    setSelected]    = useState<UserProfile[]>([]);
  const [groupName,   setGroupName]   = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating,  setIsCreating]  = useState(false);
  const { createDirect, createGroup } = useChatStore();
  const navigate                      = useNavigate();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced user search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await UsersApi.searchUsers(query);
        setResults(users);
      } catch { setResults([]); }
      finally { setIsSearching(false); }
    }, 300);
  }, [query]);

  const toggleSelect = (user: UserProfile) => {
    setSelected((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : tab === 'dm' ? [user] : [...prev, user],
    );
  };

  const handleCreate = async () => {
    if (!selected.length) return;
    setIsCreating(true);
    try {
      let convo;
      if (tab === 'dm') {
        convo = await createDirect(selected[0].id);
      } else {
        if (!groupName.trim()) return;
        convo = await createGroup(groupName, selected.map((u) => u.id));
      }
      navigate(chatRoute(convo.id));
      onClose();
    } catch (err) {
      console.error('Failed to create conversation', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New conversation</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.modalTabs}>
          <button
            className={`${styles.modalTab} ${tab === 'dm' ? styles.modalTabActive : ''}`}
            onClick={() => { setTab('dm'); setSelected([]); }}
          >
            Direct message
          </button>
          <button
            className={`${styles.modalTab} ${tab === 'group' ? styles.modalTabActive : ''}`}
            onClick={() => { setTab('group'); setSelected([]); }}
          >
            Group chat
          </button>
        </div>

        {/* Group name input */}
        {tab === 'group' && (
          <input
            className={styles.modalInput}
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        {/* Selected users pills */}
        {selected.length > 0 && (
          <div className={styles.selectedPills}>
            {selected.map((u) => (
              <span key={u.id} className={styles.pill}>
                {u.displayName}
                <button onClick={() => toggleSelect(u)}>✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <input
          className={styles.modalInput}
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {/* Results */}
        <div className={styles.searchResults}>
          {isSearching && (
            <div className={styles.searchHint}>Searching...</div>
          )}
          {!isSearching && query && results.length === 0 && (
            <div className={styles.searchHint}>No users found</div>
          )}
          {!isSearching && !query && (
            <div className={styles.searchHint}>Type to search for users</div>
          )}
          {results.map((user) => {
            const isSelected = !!selected.find((u) => u.id === user.id);
            return (
              <div
                key={user.id}
                className={`${styles.searchResult} ${isSelected ? styles.searchResultSelected : ''}`}
                onClick={() => toggleSelect(user)}
              >
                <Avatar name={user.displayName} isOnline={user.isOnline} size="sm" />
                <div className={styles.searchResultInfo}>
                  <div className={styles.searchResultName}>{user.displayName}</div>
                  <div className={styles.searchResultEmail}>{user.email}</div>
                </div>
                {isSelected && <span className={styles.checkmark}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Create button */}
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={
            isCreating ||
            !selected.length ||
            (tab === 'group' && !groupName.trim())
          }
        >
          {isCreating
            ? 'Creating...'
            : tab === 'dm'
            ? 'Start conversation'
            : `Create group (${selected.length} member${selected.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Conversation list item
// =============================================================================

const ConvoItem: React.FC<{
  convo:         any;
  isActive:      boolean;
  currentUserId: string;
  onClick:       () => void;
}> = ({ convo, isActive, currentUserId, onClick }) => {
  const otherMember = convo.type === 'DIRECT'
    ? convo.members?.find((m: any) => m.userId !== currentUserId)
    : null;

  const name     = convo.type === 'GROUP'
    ? convo.name
    : otherMember?.user?.displayName ?? 'Unknown';
  const isOnline = otherMember?.user?.isOnline ?? false;
  const lastMsg  = convo.lastMessage?.content?.text ?? '';

  return (
    <div
      className={`${styles.convoItem} ${isActive ? styles.convoItemActive : ''}`}
      onClick={onClick}
    >
      <Avatar name={name} isOnline={convo.type === 'DIRECT' ? isOnline : undefined} />
      <div className={styles.convoInfo}>
        <div className={styles.convoName}>{name}</div>
        {lastMsg && <div className={styles.lastMsg}>{lastMsg}</div>}
      </div>
    </div>
  );
};

// =============================================================================
// Message bubble
// =============================================================================

const MessageBubble: React.FC<{
  message:  any;
  isOwn:    boolean;
}> = ({ message, isOwn }) => {
  if (message.deletedAt) {
    return (
      <div className={`${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`}>
        <div className={`${styles.bubble} ${styles.deletedBubble}`}>
          <em>Message deleted</em>
        </div>
      </div>
    );
  }

  const readByOthers = Object.entries(message.deliveryStatus ?? {})
    .some(([uid, status]) => uid !== message.senderId && status === 'read');

  return (
    <div className={`${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`}>
      <div className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`}>
        {message.content?.text && (
          <p className={styles.bubbleText}>{message.content.text}</p>
        )}
        <div className={styles.bubbleMeta}>
          {message.editedAt && <span className={styles.editedTag}>edited</span>}
          <span className={styles.bubbleTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {isOwn && (
            <span className={`${styles.ticks} ${readByOthers ? styles.ticksRead : ''}`}>
              {readByOthers ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Typing indicator
// =============================================================================

const TypingIndicator: React.FC<{ names: string[] }> = ({ names }) => {
  if (!names.length) return null;
  return (
    <div className={styles.typingWrap}>
      <div className={styles.typingDots}>
        <span /><span /><span />
      </div>
      <span className={styles.typingText}>
        {names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(', ')} are typing`}
      </span>
    </div>
  );
};

// =============================================================================
// Main ChatPage
// =============================================================================

const ChatPage: React.FC = () => {
  const { conversationId }   = useParams<{ conversationId?: string }>();
  const navigate             = useNavigate();
  const user                 = useAuthStore((s) => s.user);
  const logout               = useAuthStore((s) => s.logout);
  const handleLogout         = useCallback(() => { logout(); }, [logout]);
  const [showModal, setShowModal] = useState(false);

  const {
    conversations,
    activeConvoId,
    setActiveConvo,
    typingUsers,
  } = useChatStore();

  const {
    messages,
    isLoading: isLoadingMsgs,
    inputText,
    bottomRef,
    handleInputChange,
    handleSend,
    handleKeyDown,
  } = useMessages(activeConvoId ?? '');

  const isLoadingConvos              = useChatStore((s) => s.isLoadingConvos);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile]       = useState(false);

  // Detect mobile after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1280;
      setIsMobile(mobile);
      // On mobile with no active convo — show sidebar
      // On mobile with active convo — show chat
      if (mobile && conversationId) setShowSidebar(false);
      if (!mobile) setShowSidebar(true); // desktop: always show sidebar
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [conversationId]);

  // Sync URL param → store once conversations are loaded
  useEffect(() => {
    if (conversationId && !isLoadingConvos) {
      setActiveConvo(conversationId);
      setShowSidebar(false); // mobile: hide sidebar when convo selected
    }
  }, [conversationId, isLoadingConvos, setActiveConvo]);

  const handleSelectConvo = useCallback((id: string) => {
    setActiveConvo(id);
    setShowSidebar(false); // mobile: switch to chat view
    navigate(chatRoute(id));
  }, [setActiveConvo, navigate]);

  const activeConvo = conversations.find((c) => c.id === activeConvoId);

  // Get display name for active conversation
  const getConvoName = (convo: any) => {
    if (!convo) return '';
    if (convo.type === 'GROUP') return convo.name;
    const other = convo.members?.find((m: any) => m.userId !== user?.id);
    return other?.user?.displayName ?? 'Unknown';
  };

  // Typing users in active conversation (excluding self)
  const typingNames = Array.from(typingUsers[activeConvoId ?? ''] ?? [])
    .filter((id) => id !== user?.id)
    .map((id) => {
      const member = activeConvo?.members?.find((m: any) => m.userId === id);
      return (member as any)?.user?.displayName ?? 'Someone';
    });

  // Online status for DM
  const otherMember = activeConvo?.type === 'DIRECT'
    ? activeConvo.members?.find((m: any) => m.userId !== user?.id)
    : null;
  const isOtherOnline = (otherMember as any)?.user?.isOnline ?? false;
  // const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={styles.sidebar}
        style={{ display: isMobile && !showSidebar ? 'none' : 'flex' }}
      >
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Messages</span>
          <button className={styles.newChatBtn} onClick={() => setShowModal(true)} title="New conversation">
            ✏️
          </button>
        </div>

        <div className={styles.currentUser}>
          <Avatar name={user?.displayName ?? '?'} size="sm" />
          <span className={styles.userName}>{user?.displayName}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>

        <div className={styles.convoList}>
          {isLoadingConvos && <div className={styles.hint}>Loading...</div>}
          {!isLoadingConvos && conversations.length === 0 && (
            <div className={styles.emptyConvos}>
              <p>No conversations yet</p>
              <button className={styles.startBtn} onClick={() => setShowModal(true)}>
                Start a conversation
              </button>
            </div>
          )}
          {conversations.map((convo) => (
            <ConvoItem
              key={convo.id}
              convo={convo}
              isActive={convo.id === activeConvoId}
              currentUserId={user?.id ?? ''}
              onClick={() => handleSelectConvo(convo.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main
        className={styles.main}
        style={{ display: isMobile && showSidebar ? 'none' : 'flex' }}
      >
        {activeConvo ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div className={styles.chatHeader}>
              {/* Mobile back button */}
              <button
                className={styles.backBtn}
                onClick={() => setShowSidebar(true)}
              >
                ←
              </button>
              <Avatar
                name={getConvoName(activeConvo)}
                isOnline={activeConvo.type === 'DIRECT' ? isOtherOnline : undefined}
              />
              <div>
                <div className={styles.chatName}>{getConvoName(activeConvo)}</div>
                {activeConvo.type === 'DIRECT' && (
                  <div className={styles.chatStatus}>
                    {isOtherOnline ? 'Online' : 'Offline'}
                  </div>
                )}
                {activeConvo.type === 'GROUP' && (
                  <div className={styles.chatStatus}>
                    {activeConvo.members?.length} members
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messageList}>
              {isLoadingMsgs && <div className={styles.hint}>Loading messages...</div>}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === user?.id}
                />
              ))}
              <TypingIndicator names={typingNames} />
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={styles.inputArea}>
              <textarea
                className={styles.input}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!inputText.trim()}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyMain}>
            <div className={styles.emptyIcon}>💬</div>
            <div className={styles.emptyText}>Select a conversation or start a new one</div>
            <button className={styles.startBtn} onClick={() => setShowModal(true)}>
              New conversation
            </button>
          </div>
        )}
      </main>

      {/* ── New conversation modal ────────────────────────────────────────── */}
      {showModal && <NewConversationModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

export default ChatPage;