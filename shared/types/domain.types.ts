// =============================================================================
// Core domain models — used identically on FE and BE
// =============================================================================

/** String union instead of enum so comparisons work with === in TSX */
export type UserRole = 'ADMIN' | 'WRITE' | 'READ';
export type ConversationType = 'DIRECT' | 'GROUP';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'system';
export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface User {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastSeen: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'>;
    tokens: AuthTokens;
}

export interface Conversation {
    id: string;
    type: ConversationType;
    name: string | null;
    avatarUrl: string | null;
    members: ConversationMember[];
    lastMessage: Message | null;
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationMember {
    userId: string;
    role: UserRole;
    joinedAt: string;
    lastReadAt: string;
    user?: User;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    seq: number;
    clientMsgId: string;
    type: MessageType;
    content: MessageContent;
    replyTo: string | null;
    reactions: Reaction[];
    editedAt: string | null;
    deletedAt: string | null;
    deliveryStatus: Record<string, DeliveryStatus>;
    createdAt: string;
    updatedAt: string;
}

export interface MessageContent {
    text?: string;
    url?: string;
    mimeType?: string;
    fileSize?: number;
    durationSec?: number;
    blurhash?: string;
    originalName?: string;
}

export interface Reaction {
    emoji: string;
    userIds: string[];
}