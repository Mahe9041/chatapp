/**
 * GroupInfoPanel — slide-in panel showing group members and role management.
 * Only admins see the role dropdowns. Other members see a static badge.
 */

import React, { useState } from "react";
import * as ConvoApi from "../../api/conversations.api";
import { useChatStore } from "../../store/chat.store";
import styles from "./GroupInfoPanel.module.scss";

type UserRole = "ADMIN" | "WRITE" | "READ";

interface Props {
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
}

const GroupInfoPanel: React.FC<Props> = ({
  conversationId,
  currentUserId,
  onClose,
}) => {
  const conversations = useChatStore((s) => s.conversations);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const [loading, setLoading] = useState<string | null>(null); // userId being updated

  const convo = conversations.find((c) => c.id === conversationId);
  if (!convo || convo.type !== "GROUP") return null;

  const currentMember = convo.members.find((m) => m.userId === currentUserId);
  const isAdmin = currentMember?.role === "ADMIN";

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    setLoading(targetUserId);
    try {
      await ConvoApi.changeMemberRole(conversationId, targetUserId, newRole);
      await loadConversations(); // refresh to get updated roles
    } catch (err) {
      console.error("Failed to change role", err);
    } finally {
      setLoading(null);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Leave this group?")) return;
    try {
      await ConvoApi.removeMember(conversationId, currentUserId);
      await loadConversations();
      onClose();
    } catch (err) {
      console.error("Failed to leave group", err);
    }
  };

  const roleBadgeClass = (role: string) => {
    if (role === "ADMIN") return styles.roleAdmin;
    if (role === "WRITE") return styles.roleWrite;
    return styles.roleRead;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Group info</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Group avatar + name */}
          <div className={styles.groupName}>
            <div className={styles.groupAvatar}>
              {convo.name?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.groupNameText}>{convo.name}</div>
            <div className={styles.groupMemberCount}>
              {convo.members.length} members
            </div>
          </div>

          {/* Members */}
          <div className={styles.sectionLabel}>Members</div>
          <div className={styles.memberList}>
            {convo.members.map((member) => {
              const user = (member as any).user;
              const isSelf = member.userId === currentUserId;
              const isBeingUpdated = loading === member.userId;

              return (
                <div key={member.userId} className={styles.memberItem}>
                  {/* Avatar */}
                  <div className={styles.memberAvatar}>
                    {user?.displayName?.charAt(0).toUpperCase() ?? "?"}
                    <span
                      className={`${styles.onlineDot} ${user?.isOnline ? styles.dotOnline : styles.dotOffline}`}
                    />
                  </div>

                  {/* Info */}
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>
                      {user?.displayName ?? "Unknown"}
                      {isSelf && <span className={styles.youTag}> (you)</span>}
                    </div>
                    <div className={styles.memberEmail}>
                      {user?.email ?? ""}
                    </div>
                  </div>

                  {/* Role — dropdown for admins, badge for others */}
                  {isAdmin && !isSelf ? (
                    <select
                      className={styles.roleSelect}
                      value={member.role}
                      disabled={isBeingUpdated}
                      onChange={(e) =>
                        handleRoleChange(
                          member.userId,
                          e.target.value as UserRole,
                        )
                      }
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="WRITE">Write</option>
                      <option value="READ">Read</option>
                    </select>
                  ) : (
                    <span
                      className={`${styles.roleBadge} ${roleBadgeClass(member.role)}`}
                    >
                      {member.role.charAt(0) +
                        member.role.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — leave group */}
        <div className={styles.footer}>
          <button className={styles.leaveBtn} onClick={handleLeave}>
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
