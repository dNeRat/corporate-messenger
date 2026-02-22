# Corporate Messenger – Backend

<p align="center">
  Backend API для корпоративного мессенджера  
  <br/>
  <strong>NestJS · Prisma · PostgreSQL · JWT · Role-based Auth</strong>
</p>

---

## Features

- JWT Authentication (Access Token)
- User Registration & Login
- Role-based Authorization (`USER`, `ADMIN`)
- Prisma ORM + Migrations
- PostgreSQL
- Password hashing (bcrypt)
- Chats & Messages (in progress)

---

## Tech Stack

| Technology   | Purpose |
|--------------|----------|
| NestJS       | Backend framework |
| Prisma       | ORM |
| PostgreSQL   | Database |
| JWT          | Authentication |
| bcrypt       | Password hashing |
| TypeScript   | Language |

---

# Setup & Installation

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

Create a file in `backend/.env`:

```env
DATABASE_URL="postgresql://corp_user:password@localhost:5432/corp_messenger"
JWT_SECRET="jwt"
```

---

## Setup PostgreSQL

Create database and user:

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

## Start server

```bash
npm run start:dev
```

Server runs at:

```
http://localhost:3000
```

---

# Authentication

## Register

```
POST /auth/register
```

## Login

```
POST /auth/login
```

Returns:

```json
{
  "user": { ... },
  "accessToken": "..."
}
```

---

## Get Current User

```
GET /auth/me
Authorization: Bearer <token>
```

---

# Roles

### USER
- Can authenticate
- Can access own profile

### ADMIN
- Can access:
```
GET /users
```

---

# Development Tools

### Prisma Studio

```bash
npx prisma studio
```

Open:
```
http://localhost:5555
```

---

# Roadmap

- [x] Authentication
- [x] Role-based access
- [ ] Chats
- [ ] Messages
- [ ] WebSocket
- [ ] Refresh Tokens
- [ ] Docker
- [ ] Deployment
