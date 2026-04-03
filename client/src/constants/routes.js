// =============================================================================
// constants/routes.ts
// All frontend route paths — never hardcode route strings in components.
// =============================================================================
export const ROUTES = {
    LOGIN: '/login',
    CHAT: '/chat',
    CHAT_CONVO: '/chat/:conversationId',
    DEMO: '/demo',
    NOT_FOUND: '*',
};
/** Builds a concrete chat route with a real conversationId */
export const chatRoute = (conversationId) => `/chat/${conversationId}`;
