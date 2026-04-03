// =============================================================================
// demo.service.ts
// Creates a demo session: two pre-seeded users + one conversation.
// The demo login flow calls this to bootstrap the split-screen view.
// =============================================================================

import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { generateTokens } from '../../utils/jwt.utils';
import crypto from 'crypto';

export interface DemoSession {
    sender: {
        user: { id: string; email: string; displayName: string };
        accessToken: string;
        refreshToken: string;
    };
    receiver: {
        user: { id: string; email: string; displayName: string };
        accessToken: string;
        refreshToken: string;
    };
    conversationId: string;
}

/**
 * Creates (or reuses) a demo session with two test accounts.
 * Idempotent — safe to call multiple times, returns the same session.
 */
export const getOrCreateDemoSession = async (): Promise<DemoSession> => {
    const SENDER_EMAIL = 'demo-sender@chatapp.dev';
    const RECEIVER_EMAIL = 'demo-receiver@chatapp.dev';
    const DEMO_PASSWORD = 'DemoPass123';

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Upsert sender
    const sender = await prisma.user.upsert({
        where: { email: SENDER_EMAIL },
        update: {},
        create: {
            email: SENDER_EMAIL,
            passwordHash: hash,
            displayName: 'Demo Sender',
        },
    });

    // Upsert receiver
    const receiver = await prisma.user.upsert({
        where: { email: RECEIVER_EMAIL },
        update: {},
        create: {
            email: RECEIVER_EMAIL,
            passwordHash: hash,
            displayName: 'Demo Receiver',
        },
    });

    // Find or create a direct conversation between them
    let conversation = await prisma.conversation.findFirst({
        where: {
            type: 'DIRECT',
            AND: [
                { members: { some: { userId: sender.id } } },
                { members: { some: { userId: receiver.id } } },
            ],
        },
    });

    if (!conversation) {
        conversation = await prisma.$transaction(async (tx) => {
            const convo = await tx.conversation.create({
                data: { type: 'DIRECT' },
            });
            await tx.conversationMember.createMany({
                data: [
                    { conversationId: convo.id, userId: sender.id, role: 'WRITE' },
                    { conversationId: convo.id, userId: receiver.id, role: 'WRITE' },
                ],
            });
            return convo;
        });
    }

    // Issue fresh tokens for both users
    const senderTokens = generateTokens(sender.id);
    const receiverTokens = generateTokens(receiver.id);

    // Store refresh tokens
    await prisma.refreshToken.createMany({
        data: [
            {
                userId: sender.id,
                tokenHash: crypto.createHash('sha256')
                    .update(senderTokens.refreshToken).digest('hex'),
                expiresAt: senderTokens.refreshExpiresAt,
            },
            {
                userId: receiver.id,
                tokenHash: crypto.createHash('sha256')
                    .update(receiverTokens.refreshToken).digest('hex'),
                expiresAt: receiverTokens.refreshExpiresAt,
            },
        ],
        skipDuplicates: true,
    });

    return {
        sender: {
            user: { id: sender.id, email: sender.email, displayName: sender.displayName },
            accessToken: senderTokens.accessToken,
            refreshToken: senderTokens.refreshToken,
        },
        receiver: {
            user: { id: receiver.id, email: receiver.email, displayName: receiver.displayName },
            accessToken: receiverTokens.accessToken,
            refreshToken: receiverTokens.refreshToken,
        },
        conversationId: conversation.id,
    };
};