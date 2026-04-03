import { apiClient } from './client';

export interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastSeen: string;
}

/** Search users by name or email */
export const searchUsers = async (query: string): Promise<UserProfile[]> => {
    const { data } = await apiClient.get<{ data: UserProfile[] }>('/users/search', {
        params: { q: query },
    });
    return data.data;
};

/** Get a user's public profile */
export const getUserById = async (userId: string): Promise<UserProfile> => {
    const { data } = await apiClient.get<{ data: UserProfile }>(`/users/${userId}`);
    return data.data;
};

/** Update current user's profile */
export const updateProfile = async (payload: {
    displayName?: string;
    avatarUrl?: string;
}): Promise<UserProfile> => {
    const { data } = await apiClient.patch<{ data: UserProfile }>('/users/me', payload);
    return data.data;
};