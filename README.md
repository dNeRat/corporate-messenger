# Corporate Messenger – Full Stack Realtime Chat

<p align="center">
  Корпоративный мессенджер с защищённым REST API и Realtime WebSocket  
  <br/>
  <strong>NestJS · Prisma · PostgreSQL · JWT (httpOnly Cookie) · Socket.IO · Next.js</strong>
</p>

---


#  Features

##  Authentication
- JWT Authentication
- httpOnly Cookie-based auth
- Role-based Authorization (`USER`, `ADMIN`)
- Password hashing (bcrypt)

##  Chats
- Direct chats
- Group chats
- Companion field for direct chats
- Sorting by `updatedAt`
- Last message preview

##  Messages
- Cursor-based pagination
- Real-time delivery via WebSocket
- Secure WebSocket with JWT validation
- Chat membership verification

##  Frontend
- Next.js (App Router)
- Login / Register
- Protected routes
- Chat sidebar
- Message bubbles (mine / others)
- Realtime updates

---

#  Tech Stack

| Technology        | Purpose |
|------------------|----------|
| NestJS           | Backend framework |
| Prisma           | ORM |
| PostgreSQL       | Database |
| JWT              | Authentication |
| Socket.IO        | Realtime messaging |
| bcrypt           | Password hashing |
| Next.js          | Frontend |
| TypeScript       | Language |

---

#  Backend Setup

## Clone repository

```bash
git clone https://github.com/dNeRat/corporate-messenger.git
cd corporate-messenger/backend
```

---

## Install dependencies

```bash
npm install
```

---

## Create `.env`

Create `backend/.env`:

```env
DATABASE_URL="postgresql://corp_user:password@localhost:5432/corp_messenger"
JWT_SECRET="jwt"
```

---

## Setup PostgreSQL

```sql
CREATE USER corp_user WITH PASSWORD 'password';
CREATE DATABASE corp_messenger OWNER corp_user;
```

---

## Run migrations

```bash
npx prisma migrate deploy
```

For development:

```bash
npx prisma migrate dev
```

---

## Start backend

```bash
npm run start:dev
```

Backend runs at:

```
http://localhost:3000
```

---

# Frontend Setup

```bash
cd ../frontend
npm install
npm run dev -- -p 3001
```

Frontend runs at:

```
http://localhost:3001
```

---

# Authentication (Cookie-based)

## Register

```
POST /auth/register
```

## Login

```
POST /auth/login
```

Sets:

```
httpOnly access_token cookie
```

---

## Get Current User

```
GET /auth/me
```

Cookie is sent automatically.

---

# Chat API

## Create Chat

```
POST /chats
```

## List My Chats

```
GET /chats
```

Includes:
- `updatedAt`
- `messages[0]` as lastMessage
- `companion` for direct chats

---

## Send Message

```
POST /chats/:id/messages
```

---

## Get Messages (Cursor Pagination)

```
GET /chats/:id/messages?take=30
GET /chats/:id/messages?cursor=123&take=30
```

---

# WebSocket

Uses JWT validation via cookie or auth token.

### Client connects to:

```
ws://localhost:3000
```

### Events

| Event        | Direction | Description |
|-------------|----------|-------------|
| join_chat   | client → server | Join chat room |
| new_message | server → client | New message event |

Only chat members can join rooms.

---

# Roles

### USER
- Create chats
- Send messages
- Access own chats

### ADMIN
- Access `/users`
- Manage system users

---

# Development Tools

## Prisma Studio

```bash
npx prisma studio
```

Open:

```
http://localhost:5555
```

---

# Roadmap

- [x] JWT Authentication
- [x] Role-based access
- [x] Chats
- [x] Messages
- [x] Realtime WebSocket
- [x] httpOnly Cookie Auth
- [x] Frontend (Next.js)
- [ ] Refresh Tokens
- [ ] File attachments
- [ ] Typing indicator
- [ ] Docker
- [ ] Deployment

---

# Current Status

Fully working realtime corporate messenger  
Secure REST + WebSocket  
Full-stack architecture  
