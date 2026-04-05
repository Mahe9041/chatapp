/**
 * ChatPage — fixed version
 * Changes from broken version:
 *  1. Removed duplicate `isMobile` const declaration (was causing TS compile error)
 *  2. Added `showGroupInfo` state + wired GroupInfoPanel into JSX
 *  3. Added MediaUploadButton into the inputArea
 *  4. Clicking the group name/header opens GroupInfoPanel
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { useMessages } from "../../hooks/useMessages";
import { chatRoute } from "../../constants/routes";
import * as UsersApi from "../../api/users.api";
import type { UserProfile } from "../../api/users.api";
import GroupInfoPanel from "./GroupInfoPanel";
import MediaUploadButton from "./MediaUploadButton";
import styles from "./ChatPage.module.scss";

// =============================================================================
// Avatar component
// =============================================================================

const Avatar: React.FC<{
  name: string;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg";
}> = ({ name, isOnline, size = "md" }) => (
  <div className={`${styles.avatar} ${styles[`avatar_${size}`]}`}>
    <span>{name?.charAt(0).toUpperCase()}</span>
    {isOnline !== undefined && (
      <span
        className={`${styles.onlineDot} ${isOnline ? styles.online : styles.offline}`}
      />
    )}
  </div>
);

// =============================================================================
// New Conversation Modal
// =============================================================================

const NewConversationModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [tab, setTab] = useState<"dm" | "group">("dm");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { createDirect, createGroup } = useChatStore();
  const navigate = useNavigate();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        setResults(await UsersApi.searchUsers(query));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [query]);

  const toggleSelect = (user: UserProfile) => {
    setSelected((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : tab === "dm"
          ? [user]
          : [...prev, user],
    );
  };

  const handleCreate = async () => {
    if (!selected.length) return;
    setIsCreating(true);
    try {
      let convo;
      if (tab === "dm") {
        convo = await createDirect(selected[0].id);
      } else {
        if (!groupName.trim()) return;
        convo = await createGroup(
          groupName,
          selected.map((u) => u.id),
        );
      }
      navigate(chatRoute(convo.id));
      onClose();
    } catch (err) {
      console.error("Failed to create conversation", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New conversation</h2>
          <button className={styles.modalClose} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalTabs}>
          <button
            className={`${styles.modalTab} ${tab === "dm" ? styles.modalTabActive : ""}`}
            onClick={() => {
              setTab("dm");
              setSelected([]);
            }}
          >
            Direct message
          </button>
          <button
            className={`${styles.modalTab} ${tab === "group" ? styles.modalTabActive : ""}`}
            onClick={() => {
              setTab("group");
              setSelected([]);
            }}
          >
            Group chat
          </button>
        </div>
        {tab === "group" && (
          <input
            className={styles.modalInput}
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}
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
        <input
          className={styles.modalInput}
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className={styles.searchResults}>
          {isSearching && <div className={styles.searchHint}>Searching...</div>}
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
                className={`${styles.searchResult} ${isSelected ? styles.searchResultSelected : ""}`}
                onClick={() => toggleSelect(user)}
              >
                <Avatar
                  name={user.displayName}
                  isOnline={user.isOnline}
                  size="sm"
                />
                <div className={styles.searchResultInfo}>
                  <div className={styles.searchResultName}>
                    {user.displayName}
                  </div>
                  <div className={styles.searchResultEmail}>{user.email}</div>
                </div>
                {isSelected && <span className={styles.checkmark}>✓</span>}
              </div>
            );
          })}
        </div>
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={
            isCreating ||
            !selected.length ||
            (tab === "group" && !groupName.trim())
          }
        >
          {isCreating
            ? "Creating..."
            : tab === "dm"
              ? "Start conversation"
              : `Create group (${selected.length} member${selected.length !== 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Conversation list item
// =============================================================================

const ConvoItem: React.FC<{
  convo: any;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}> = ({ convo, isActive, currentUserId, onClick }) => {
  const otherMember =
    convo.type === "DIRECT"
      ? convo.members?.find((m: any) => m.userId !== currentUserId)
      : null;
  const name =
    convo.type === "GROUP"
      ? convo.name
      : (otherMember?.user?.displayName ?? "Unknown");
  const isOnline = otherMember?.user?.isOnline ?? false;
  const lastMsg = convo.lastMessage?.content?.text ?? "";

  return (
    <div
      className={`${styles.convoItem} ${isActive ? styles.convoItemActive : ""}`}
      onClick={onClick}
    >
      <Avatar
        name={name}
        isOnline={convo.type === "DIRECT" ? isOnline : undefined}
      />
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

const MessageBubble: React.FC<{ message: any; isOwn: boolean }> = ({
  message,
  isOwn,
}) => {
  if (message.deletedAt) {
    return (
      <div
        className={`${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`}
      >
        <div className={`${styles.bubble} ${styles.deletedBubble}`}>
          <em>Message deleted</em>
        </div>
      </div>
    );
  }

  const readByOthers = Object.entries(message.deliveryStatus ?? {}).some(
    ([uid, status]) => uid !== message.senderId && status === "read",
  );

  return (
    <div
      className={`${styles.bubbleWrap} ${isOwn ? styles.ownWrap : styles.otherWrap}`}
    >
      <div
        className={`${styles.bubble} ${isOwn ? styles.ownBubble : styles.otherBubble}`}
      >
        {message.content?.text && (
          <p className={styles.bubbleText}>{message.content.text}</p>
        )}
        {/* ── Media content ── */}
        {message.content?.url && message.type === "image" && (
          <img
            src={message.content.url}
            alt={message.content.originalName ?? "image"}
            style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
          />
        )}
        {message.content?.url && message.type === "audio" && (
          <audio controls src={message.content.url} style={{ width: "100%" }} />
        )}
        {message.content?.url && message.type === "video" && (
          <video
            controls
            src={message.content.url}
            style={{ maxWidth: "100%", borderRadius: 8 }}
          />
        )}
        {message.content?.url && message.type === "document" && (
          <a
            href={message.content.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: "inherit",
              textDecoration: "underline",
            }}
          >
            📄 {message.content.originalName ?? "Download file"}
          </a>
        )}
        <div className={styles.bubbleMeta}>
          {message.editedAt && <span className={styles.editedTag}>edited</span>}
          <span className={styles.bubbleTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOwn && (
            <span
              className={`${styles.ticks} ${readByOthers ? styles.ticksRead : ""}`}
            >
              {readByOthers ? "✓✓" : "✓"}
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
        <span />
        <span />
        <span />
      </div>
      <span className={styles.typingText}>
        {names.length === 1
          ? `${names[0]} is typing`
          : `${names.slice(0, 2).join(", ")} are typing`}
      </span>
    </div>
  );
};

// =============================================================================
// Main ChatPage
// =============================================================================

const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const [showModal, setShowModal] = useState(false);
  // FIX 2: added showGroupInfo state — was completely missing before
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const { conversations, activeConvoId, setActiveConvo, typingUsers } =
    useChatStore();
  const {
    messages,
    isLoading: isLoadingMsgs,
    inputText,
    bottomRef,
    handleInputChange,
    handleSend,
    handleKeyDown,
  } = useMessages(activeConvoId ?? "");

  const isLoadingConvos = useChatStore((s) => s.isLoadingConvos);
  const [showSidebar, setShowSidebar] = useState(true);

  // FIX 1: single isMobile — useState only, no duplicate const below
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && conversationId) setShowSidebar(false);
      if (!mobile) setShowSidebar(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && !isLoadingConvos) {
      setActiveConvo(conversationId);
      setShowSidebar(false);
    }
  }, [conversationId, isLoadingConvos, setActiveConvo]);

  const handleSelectConvo = useCallback(
    (id: string) => {
      setActiveConvo(id);
      setShowSidebar(false);
      navigate(chatRoute(id));
    },
    [setActiveConvo, navigate],
  );

  const activeConvo = conversations.find((c) => c.id === activeConvoId);

  const getConvoName = (convo: any) => {
    if (!convo) return "";
    if (convo.type === "GROUP") return convo.name;
    const other = convo.members?.find((m: any) => m.userId !== user?.id);
    return other?.user?.displayName ?? "Unknown";
  };

  const typingNames = Array.from(typingUsers[activeConvoId ?? ""] ?? [])
    .filter((id) => id !== user?.id)
    .map((id) => {
      const member = activeConvo?.members?.find((m: any) => m.userId === id);
      return (member as any)?.user?.displayName ?? "Someone";
    });

  const otherMember =
    activeConvo?.type === "DIRECT"
      ? activeConvo.members?.find((m: any) => m.userId !== user?.id)
      : null;
  const isOtherOnline = (otherMember as any)?.user?.isOnline ?? false;

  // Close group panel when switching conversations
  useEffect(() => {
    setShowGroupInfo(false);
  }, [activeConvoId]);

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside
        className={styles.sidebar}
        style={{ display: isMobile && !showSidebar ? "none" : "flex" }}
      >
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Messages</span>
          <button
            className={styles.newChatBtn}
            onClick={() => setShowModal(true)}
            title="New conversation"
          >
            ✏️
          </button>
        </div>
        <div className={styles.currentUser}>
          <Avatar name={user?.displayName ?? "?"} size="sm" />
          <span className={styles.userName}>{user?.displayName}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
        <div className={styles.convoList}>
          {isLoadingConvos && <div className={styles.hint}>Loading...</div>}
          {!isLoadingConvos && conversations.length === 0 && (
            <div className={styles.emptyConvos}>
              <p>No conversations yet</p>
              <button
                className={styles.startBtn}
                onClick={() => setShowModal(true)}
              >
                Start a conversation
              </button>
            </div>
          )}
          {conversations.map((convo) => (
            <ConvoItem
              key={convo.id}
              convo={convo}
              isActive={convo.id === activeConvoId}
              currentUserId={user?.id ?? ""}
              onClick={() => handleSelectConvo(convo.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <main
        className={styles.main}
        style={{ display: isMobile && showSidebar ? "none" : "flex" }}
      >
        {activeConvo ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* Header — FIX 3: clicking group name opens GroupInfoPanel */}
            <div className={styles.chatHeader}>
              <button
                className={styles.backBtn}
                onClick={() => setShowSidebar(true)}
              >
                ←
              </button>
              <Avatar
                name={getConvoName(activeConvo)}
                isOnline={
                  activeConvo.type === "DIRECT" ? isOtherOnline : undefined
                }
              />
              <div
                style={{
                  flex: 1,
                  cursor: activeConvo.type === "GROUP" ? "pointer" : "default",
                }}
                onClick={() =>
                  activeConvo.type === "GROUP" && setShowGroupInfo(true)
                }
              >
                <div className={styles.chatName}>
                  {getConvoName(activeConvo)}
                </div>
                {activeConvo.type === "DIRECT" && (
                  <div className={styles.chatStatus}>
                    {isOtherOnline ? "Online" : "Offline"}
                  </div>
                )}
                {activeConvo.type === "GROUP" && (
                  <div className={styles.chatStatus}>
                    {activeConvo.members?.length} members · tap to manage
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messageList}>
              {isLoadingMsgs && (
                <div className={styles.hint}>Loading messages...</div>
              )}
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

            {/* Input — FIX 1: MediaUploadButton is now actually rendered */}
            <div className={styles.inputArea}>
              <MediaUploadButton
                conversationId={activeConvoId ?? ""}
                disabled={!activeConvoId}
              />
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
            <div className={styles.emptyText}>
              Select a conversation or start a new one
            </div>
            <button
              className={styles.startBtn}
              onClick={() => setShowModal(true)}
            >
              New conversation
            </button>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showModal && (
        <NewConversationModal onClose={() => setShowModal(false)} />
      )}

      {/* FIX 3: GroupInfoPanel now conditionally rendered with proper state */}
      {showGroupInfo && activeConvo?.type === "GROUP" && user?.id && (
        <GroupInfoPanel
          conversationId={activeConvoId ?? ""}
          currentUserId={user.id}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
    </div>
  );
};

export default ChatPage;
