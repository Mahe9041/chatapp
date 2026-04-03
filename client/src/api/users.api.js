import { apiClient } from './client';
/** Search users by name or email */
export const searchUsers = async (query) => {
    const { data } = await apiClient.get('/users/search', {
        params: { q: query },
    });
    return data.data;
};
/** Get a user's public profile */
export const getUserById = async (userId) => {
    const { data } = await apiClient.get(`/users/${userId}`);
    return data.data;
};
/** Update current user's profile */
export const updateProfile = async (payload) => {
    const { data } = await apiClient.patch('/users/me', payload);
    return data.data;
};
