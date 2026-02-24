-- CreateTable
CREATE TABLE "ChatRead" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatRead_chatId_idx" ON "ChatRead"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRead_chatId_userId_key" ON "ChatRead"("chatId", "userId");

-- AddForeignKey
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
