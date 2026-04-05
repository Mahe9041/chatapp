import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * GroupInfoPanel — slide-in panel showing group members and role management.
 * Only admins see the role dropdowns. Other members see a static badge.
 */
import { useState } from "react";
import * as ConvoApi from "../../api/conversations.api";
import { useChatStore } from "../../store/chat.store";
import styles from "./GroupInfoPanel.module.scss";
const GroupInfoPanel = ({ conversationId, currentUserId, onClose, }) => {
    const conversations = useChatStore((s) => s.conversations);
    const loadConversations = useChatStore((s) => s.loadConversations);
    const [loading, setLoading] = useState(null); // userId being updated
    const convo = conversations.find((c) => c.id === conversationId);
    if (!convo || convo.type !== "GROUP")
        return null;
    const currentMember = convo.members.find((m) => m.userId === currentUserId);
    const isAdmin = currentMember?.role === "ADMIN";
    const handleRoleChange = async (targetUserId, newRole) => {
        setLoading(targetUserId);
        try {
            await ConvoApi.changeMemberRole(conversationId, targetUserId, newRole);
            await loadConversations(); // refresh to get updated roles
        }
        catch (err) {
            console.error("Failed to change role", err);
        }
        finally {
            setLoading(null);
        }
    };
    const handleLeave = async () => {
        if (!confirm("Leave this group?"))
            return;
        try {
            await ConvoApi.removeMember(conversationId, currentUserId);
            await loadConversations();
            onClose();
        }
        catch (err) {
            console.error("Failed to leave group", err);
        }
    };
    const roleBadgeClass = (role) => {
        if (role === "ADMIN")
            return styles.roleAdmin;
        if (role === "WRITE")
            return styles.roleWrite;
        return styles.roleRead;
    };
    return (_jsx("div", { className: styles.overlay, onClick: onClose, children: _jsxs("div", { className: styles.panel, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Group info" }), _jsx("button", { className: styles.closeBtn, onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: styles.body, children: [_jsxs("div", { className: styles.groupName, children: [_jsx("div", { className: styles.groupAvatar, children: convo.name?.charAt(0).toUpperCase() }), _jsx("div", { className: styles.groupNameText, children: convo.name }), _jsxs("div", { className: styles.groupMemberCount, children: [convo.members.length, " members"] })] }), _jsx("div", { className: styles.sectionLabel, children: "Members" }), _jsx("div", { className: styles.memberList, children: convo.members.map((member) => {
                                const user = member.user;
                                const isSelf = member.userId === currentUserId;
                                const isBeingUpdated = loading === member.userId;
                                return (_jsxs("div", { className: styles.memberItem, children: [_jsxs("div", { className: styles.memberAvatar, children: [user?.displayName?.charAt(0).toUpperCase() ?? "?", _jsx("span", { className: `${styles.onlineDot} ${user?.isOnline ? styles.dotOnline : styles.dotOffline}` })] }), _jsxs("div", { className: styles.memberInfo, children: [_jsxs("div", { className: styles.memberName, children: [user?.displayName ?? "Unknown", isSelf && _jsx("span", { className: styles.youTag, children: " (you)" })] }), _jsx("div", { className: styles.memberEmail, children: user?.email ?? "" })] }), isAdmin && !isSelf ? (_jsxs("select", { className: styles.roleSelect, value: member.role, disabled: isBeingUpdated, onChange: (e) => handleRoleChange(member.userId, e.target.value), children: [_jsx("option", { value: "ADMIN", children: "Admin" }), _jsx("option", { value: "WRITE", children: "Write" }), _jsx("option", { value: "READ", children: "Read" })] })) : (_jsx("span", { className: `${styles.roleBadge} ${roleBadgeClass(member.role)}`, children: member.role.charAt(0) +
                                                member.role.slice(1).toLowerCase() }))] }, member.userId));
                            }) })] }), _jsx("div", { className: styles.footer, children: _jsx("button", { className: styles.leaveBtn, onClick: handleLeave, children: "Leave group" }) })] }) }));
};
export default GroupInfoPanel;
