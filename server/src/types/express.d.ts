import type { MemberRole } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                displayName: string;
                avatarUrl: string | null;
            };
            memberRole?: MemberRole;
        }
    }
}

export { };