# ChatApp — Real-Time Chat System

> A production-grade real-time chat application built for the Founding Backend Engineer assignment.
> Live demo → **[chatapp-bht.pages.dev](https://chatapp-bht.pages.dev)**

---

## What is this?

A full-stack chat system — think WhatsApp, but built from scratch. Users can:

- Register and log in securely
- Start 1-to-1 direct messages or group chats
- Send messages that arrive **instantly** on the other person's screen
- See when someone is typing
- See who's online or offline in real time
- Upload images, audio, video and documents
- Group admins can control who can read or write

---

## Live URLs

| Layer | URL |
|---|---|
| Frontend | https://chatapp-bht.pages.dev |
| Backend API | https://chatapp-server-jsap.onrender.com |
| Health check | https://chatapp-server-jsap.onrender.com/health |
| Demo mode | https://chatapp-bht.pages.dev/demo |

---

## Architecture — explained simply

> Imagine you're building a postal system. The old way: every time you want to know if you got mail, you walk to the post box and check. That's what normal HTTP does — the browser **asks** the server "anything new?" over and over.
>
> WebSockets are different. It's like having a dedicated phone line open between you and the server. The moment something happens, the server **calls you**. No asking needed.

Here's how all the pieces fit together:

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTS                          │
│   React (Cloudflare Pages)  ←→  Socket.io client       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│                   BACKEND (Render)                      │
│                                                         │
│   Express REST API          Socket.io WebSocket Server  │
│   ├── /api/auth             ├── message:send            │
│   ├── /api/conversations    ├── typing:start/stop       │
│   ├── /api/messages         ├── presence:update         │
│   └── /api/users            └── read:receipt            │
│                                                         │
│   BullMQ (job queue for offline delivery)               │
└──────┬──────────┬──────────┬───────────────────────────┘
       │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼────┐
│Postgres │ │MongoDB  │ │ Redis  │
│(users,  │ │(messages│ │(presence
│ groups) │ │ media)  │ │ queues)│
└─────────┘ └─────────┘ └────────┘
```

---

## Assignment Questions — Answered

### 1. What are you using for implementing WebSockets?

**Socket.io** — and here's exactly why we chose it over raw WebSockets:

| Feature | Raw WebSocket | Socket.io |
|---|---|---|
| Auto-reconnect | ❌ You build it | ✅ Built in |
| Rooms (group chats) | ❌ You build it | ✅ Built in |
| Fallback for bad networks | ❌ None | ✅ Falls back to long-polling |
| Acknowledgements (message delivery confirm) | ❌ You build it | ✅ Built in |
| Scale across multiple servers | ❌ Complex | ✅ Redis adapter |

Think of Socket.io as WebSockets with a seatbelt. Raw WebSockets are like driving without one — works fine until it doesn't.

**How the connection works:**

```
1. User logs in → gets a JWT access token
2. Client opens Socket.io connection → sends token as auth
3. Server verifies the JWT → rejects if invalid (auth happens BEFORE connection)
4. Server joins the user to all their conversation "rooms"
5. From this point, any message to a room instantly reaches all members
```

**Code that makes this happen:**

```typescript
// Server — every message sent to a conversation room reaches all members
io.to(`conversation:${conversationId}`).emit('message:new', message);

// Client — listens for new messages and updates the UI instantly
socket.on('message:new', (message) => {
  store.addMessage(message);
});
```

**Scaling to multiple servers:**

If we run 2 servers, User A might be connected to Server 1 and User B to Server 2. Without a bridge, A's message never reaches B.

We solve this with the **Socket.io Redis adapter**. Redis acts as a shared message bus between all servers. Server 1 publishes to Redis → Server 2 receives → delivers to User B. Adding more servers is then just adding instances — zero code change.

```
Server 1 ──publishes──▶ Redis ──subscribes──▶ Server 2
   (User A connected)                          (User B connected)
```

---

### 2. How do you support other message types — audio, documents, images, video?

**The key insight: never send binary files through WebSockets.**

Here's why: WebSockets are designed for small, fast messages. Sending a 50MB video through a WebSocket would block all other messages for everyone on that server. It's like using a phone call to fax a document — wrong tool.

**Our approach — Presigned URL uploads:**

```
Step 1: Client tells server "I want to upload a 5MB image"
        POST /api/media/presign
        
Step 2: Server validates (type allowed? size within limit?) 
        Returns a presigned URL directly to Cloudflare R2
        
Step 3: Client uploads the file DIRECTLY to R2 (skips our server entirely)
        PUT https://r2.cloudflarestorage.com/bucket/file.jpg
        
Step 4: Client sends a WebSocket message with just the URL + metadata
        { type: 'image', url: 'https://cdn.../file.jpg', blurhash: 'L6P...' }
        
Step 5: Server stores the metadata in MongoDB
        Broadcasts the message to all conversation members
```

This means our server **never touches the binary data**. It just orchestrates. This is how WhatsApp, Telegram and Slack all work at scale.

**File type limits:**

| Type | Allowed formats | Max size |
|---|---|---|
| Image | JPEG, PNG, WebP, GIF | 10 MB |
| Audio | MP3, OGG, WebM | 25 MB |
| Video | MP4, WebM | 100 MB |
| Document | PDF, Word (.doc, .docx) | 20 MB |

**Client-side image compression** happens before upload — images over 1MB are resized to max 1920px and re-encoded as WebP at 85% quality. A 8MB photo becomes ~800KB. Users get faster uploads, we get cheaper storage.

**Blurhash** — when an image is uploaded, we generate a tiny blurred placeholder (30 bytes of text) that shows while the real image loads. This is the same technique used by Medium, Facebook and Notion.

---

### 3. How do we check if someone is typing?

**Typing indicators are ephemeral — they should never touch a database.**

The flow is deliberately simple:

```
User starts typing
    │
    ▼
Client emits 'typing:start' to server
    │
    ▼
Server broadcasts 'typing:start' to everyone else in the room
(NOT back to the sender — they already know they're typing)
    │
    ▼
Other clients show "Mahesh is typing..." with animated dots
    │
    ├── User sends message → client emits 'typing:stop' immediately
    │
    └── User stops typing → client waits 1.5 seconds, then emits 'typing:stop'
```

**The server also has a 5-second safety net:**

What happens if a user's browser crashes mid-typing? They never send `typing:stop`. Without a safety net, everyone in the chat sees "X is typing..." forever.

```typescript
// Server — auto-clears stale typing state after 5 seconds
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

socket.on('typing:start', (payload) => {
  // Broadcast to room
  socket.to(`conversation:${payload.conversationId}`)
    .emit('typing:start', { ...payload, userId });

  // Reset the auto-clear timer
  const key = `${userId}:${payload.conversationId}`;
  clearTimeout(typingTimeouts.get(key));
  typingTimeouts.set(key, setTimeout(() => {
    socket.to(`conversation:${payload.conversationId}`)
      .emit('typing:stop', { ...payload, userId });
  }, 5000)); // 5 second safety net
});
```

**Why not debounce on the server?**
We debounce on the **client** (1.5s after last keystroke). The server just relays. This minimises server load — a fast typist sends `typing:start` once, not on every keypress.

---

### 4. How do you separate Admin, Read, and Write members in a group?

**Role-Based Access Control (RBAC) — stored in PostgreSQL.**

Every group member has a role stored in a junction table:

```sql
-- conversation_members table
conversationId | userId | role  | joinedAt
───────────────────────────────────────────
group-123      | user-A | ADMIN | 2024-01-01
group-123      | user-B | WRITE | 2024-01-01  
group-123      | user-C | READ  | 2024-01-01
```

**Role hierarchy:**

```
ADMIN  (3) → Can do everything below + add/remove members, change roles, edit group
  │
WRITE  (2) → Can send messages and upload media
  │
READ   (1) → Can only view messages, cannot send anything
```

**Enforcement happens in two places:**

**1. HTTP REST API — middleware layer:**
```typescript
// Role check runs BEFORE the route handler
router.post(
  '/:conversationId/messages',
  authMiddleware,           // Step 1: Is this a valid user?
  requireRole('WRITE'),     // Step 2: Do they have write permission?
  MessageController.send    // Step 3: Only reached if both pass
);
```

**2. WebSocket — inside the event handler:**
```typescript
socket.on('message:send', async (payload, ack) => {
  const member = await ConvoRepo.findMember(payload.conversationId, userId);
  
  if (!member) {
    return ack({ status: 'error', code: 'NOT_A_MEMBER' });
  }
  
  if (member.role === 'READ') {
    return ack({ status: 'error', code: 'PERMISSION_DENIED' });
  }
  
  // Only WRITE and ADMIN reach here
  const message = await MessageService.send(userId, payload);
  io.to(`conversation:${payload.conversationId}`).emit('message:new', message);
  ack({ status: 'ok', seq: message.seq });
});
```

READ members join the Socket.io room (they receive messages) but their send events are silently rejected. They receive a `permission_denied` acknowledgement.

**Why PostgreSQL for roles, not MongoDB?**

Roles and group memberships are **relational data** — they have foreign keys, constraints, and need to be consistent. "User A is an admin of Group B" is a relationship. PostgreSQL enforces this with `UNIQUE(conversationId, userId)` constraints, so a user can never accidentally have two roles in the same group.

Messages, on the other hand, are **document data** — schemaless, high volume, append-only. MongoDB is better for that. Using the right database for the right job is a core engineering principle.

---

## Tech Stack — and why each choice

### Backend

| Technology | Why we chose it |
|---|---|
| **Node.js + Express** | Non-blocking I/O is perfect for a chat app — thousands of concurrent connections without spawning threads |
| **Socket.io** | Production-ready WebSockets with rooms, reconnection, and Redis scaling built in |
| **PostgreSQL (Supabase)** | Users, groups, roles — relational data with strict constraints |
| **MongoDB (Atlas)** | Messages — high volume, schema-flexible, excellent for time-series data |
| **Redis (Upstash)** | Presence (online/offline), Socket.io multi-server adapter, BullMQ job queue |
| **BullMQ** | Delivers messages to users who were offline when the message was sent |
| **Prisma** | Type-safe database queries — the compiler catches SQL mistakes, not production |
| **Zod** | Validates every request at the boundary — app refuses to process malformed data |
| **Pino** | Structured JSON logging — machine-readable in production, pretty-printed in dev |

### Frontend

| Technology | Why we chose it |
|---|---|
| **React + Vite** | Fast builds, excellent DX, industry standard |
| **Zustand** | Lightweight state management — simpler than Redux, more predictable than Context |
| **Socket.io client** | Pairs with the server, handles reconnection automatically |
| **SCSS Modules** | Scoped styles, design tokens, no class name collisions |
| **TypeScript** | Shared types between frontend and backend — a type change in one place shows errors in both |

### DevOps (all free tier)

| Service | Purpose |
|---|---|
| **Cloudflare Pages** | Frontend hosting — CDN, unlimited bandwidth, auto-deploy from GitHub |
| **Render** | Backend hosting — Node.js runtime, WebSocket support, auto-deploy |
| **Supabase** | PostgreSQL — managed, backups, dashboard |
| **MongoDB Atlas** | MongoDB — managed, free 512MB tier |
| **Upstash** | Redis — serverless, pay-per-request, free tier |
| **GitHub Actions** | CI/CD — lint + type-check on every pull request |

---

## Project Structure

```
chatapp/
├── client/                  # React frontend (Cloudflare Pages)
│   ├── src/
│   │   ├── api/             # All HTTP calls — nothing else touches fetch()
│   │   ├── socket/          # Socket.io client + event handlers
│   │   ├── store/           # Zustand stores (auth, chat, ui)
│   │   ├── hooks/           # Data fetching and business logic
│   │   ├── pages/           # Route-level components
│   │   ├── components/      # Reusable UI components
│   │   └── styles/          # Design tokens → SCSS variables
│
├── server/                  # Node.js backend (Render)
│   ├── src/
│   │   ├── modules/         # Feature modules (auth, messages, conversations...)
│   │   │   └── [module]/
│   │   │       ├── *.schema.ts      # Zod validation
│   │   │       ├── *.repository.ts  # Database queries only
│   │   │       ├── *.service.ts     # Business logic only
│   │   │       ├── *.controller.ts  # HTTP handlers (≤20 lines each)
│   │   │       └── *.routes.ts      # Route registration
│   │   ├── socket/          # Socket.io server + event handlers
│   │   ├── queue/           # BullMQ workers and job definitions
│   │   ├── middleware/       # Auth, role check, rate limit, error handler
│   │   └── config/          # Env validation, DB connections
│
└── shared/                  # TypeScript types shared between FE and BE
    └── types/
        ├── domain.types.ts  # User, Message, Conversation
        └── socket.types.ts  # All WebSocket event payloads
```

---

## Key Engineering Decisions

### Why a modular monolith, not microservices?

At early stage, microservices add operational complexity without adding value. We built a **modular monolith** — each feature is a self-contained module (auth, messages, conversations) with no cross-module imports except through defined interfaces. When scale demands it, each module can be extracted into a separate service with minimal refactoring.

### Why two databases?

**PostgreSQL** for structured, relational data (users, groups, roles). Strong consistency, foreign key constraints, ACID transactions.

**MongoDB** for messages. A chat app can have millions of messages. MongoDB's document model maps naturally to a message with nested content, reactions and delivery status. Horizontal sharding is also much simpler.

### Why BullMQ for offline delivery?

WebSockets only work when the user is connected. If User B is offline when User A sends a message, the WebSocket broadcast fails silently. BullMQ queues a delivery job that retries with exponential backoff (2s → 4s → 8s → 16s → 32s). When User B reconnects, the pending messages are delivered. This is the same pattern used by Slack and WhatsApp.

### Message ordering — the sequence number

Race conditions in group chats are real. Two users send messages simultaneously — which arrives first? The client could show them in different orders for different users.

We solve this with a **per-conversation atomic sequence number** stored in MongoDB:

```typescript
// Atomically increment and return the next sequence number
const counter = await ConversationCounter.findOneAndUpdate(
  { conversationId },
  { $inc: { seq: 1 } },
  { upsert: true, new: true }
);
```

Every message gets a guaranteed-unique `seq` number. Clients sort by `seq`, not by timestamp. Two clients always see messages in the same order.

### Deduplication — `clientMsgId`

What happens if a user sends a message and their connection drops before they get the acknowledgement? They retry. Without deduplication, the message is stored twice.

Every message includes a client-generated UUID (`clientMsgId`). The server has a **unique index** on `(conversationId, clientMsgId)`. If the client retries, the second insert fails with a duplicate key error, which the server catches and returns a success response (the message was already saved). The user never sees a duplicate.

---

## Running Locally

### Prerequisites
- Node.js 20+
- Accounts on: Supabase, MongoDB Atlas, Upstash

### Setup

```bash
# Clone
git clone https://github.com/Mahe9041/chatapp
cd chatapp

# Install all workspaces
npm install

# Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Fill in your database URLs in server/.env

# Run database migrations
cd server && npx prisma migrate dev

# Start both servers
cd .. && npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000
Health: http://localhost:4000/health

---

## Demo Mode

Visit `/demo` to see a live split-screen demonstration:

- **Left panel** — Sender chat interface
- **Centre panel** — Real-time system flow diagram showing exactly where your message is at each millisecond (client → WebSocket → permission check → DB write → broadcast → receiver)
- **Right panel** — Receiver interface updating in real time
- **Offline toggle** — Disconnect the receiver to see BullMQ queue the message and deliver it on reconnect
- **Latency breakdown** — Per-stage timing for every message

---

## API Reference

### Auth
```
POST /api/auth/register    Create account
POST /api/auth/login       Login
POST /api/auth/refresh     Refresh access token
POST /api/auth/logout      Logout
GET  /api/auth/me          Get current user
```

### Conversations
```
POST /api/conversations/direct          Start a DM
POST /api/conversations/group           Create a group
GET  /api/conversations                 List all conversations
GET  /api/conversations/:id             Get single conversation
GET  /api/conversations/:id/messages    Get messages (paginated)
POST /api/conversations/:id/members     Add member (admin only)
DEL  /api/conversations/:id/members/:userId   Remove member
PATCH /api/conversations/:id/members/:userId/role  Change role
```

### Messages
```
POST   /api/messages                Send message
PATCH  /api/messages/:id            Edit message
DELETE /api/messages/:id            Delete message (soft)
POST   /api/messages/:id/react      Toggle emoji reaction
```

### Media
```
POST /api/media/presign    Get presigned upload URL
POST /api/media/confirm    Confirm upload completed
```

### Users
```
GET   /api/users/search?q=  Search users by name/email
GET   /api/users/:id        Get user profile
PATCH /api/users/me         Update own profile
```

### WebSocket Events

**Client → Server**
```
message:send      Send a message (with ack callback)
message:edit      Edit a message
message:delete    Delete a message
message:react     Toggle reaction
typing:start      Started typing
typing:stop       Stopped typing
read:mark         Mark messages as read
presence:ping     Keep-alive ping (every 25s)
demo:join         Join demo observer room
```

**Server → Client**
```
message:new       New message arrived
message:edited    Message was edited
message:deleted   Message was deleted
message:reaction  Reaction changed
typing:start      Someone started typing
typing:stop       Someone stopped typing
presence:update   User came online/went offline
read:receipt      Someone read your messages
demo:trace        Live system trace event (demo mode)
```

---

## Author

**Senapathi Mahesh**
GitHub: [@Mahe9041](https://github.com/Mahe9041)
