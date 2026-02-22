Backend для корпоративного мессенджера.
Стек: NestJS + Prisma + PostgreSQL + JWT + Role-based auth

Node.js
NestJS
Prisma ORM
PostgreSQL
JWT
bcrypt

git clone https://github.com/dNeRat/corporate-messenger.git
cd ./backend
npm install
Создать .env, пример:
DATABASE_URL="postgresql://corp_user:password@localhost:5432/corp_messenger"
JWT_SECRET=""

Создать юзера и базу
CREATE USER corp_user WITH PASSWORD 'password';
CREATE DATABASE corp_messenger OWNER corp_user;

Применить миграции
npx prisma migrate deploy
или для dev - npx prisma migrate dev

Запуск для dev - npm run start:dev

http://localhost:3000

API
Основные:
POST /auth/register
POST /auth/login
GET /auth/me

Админ:
GET /users
