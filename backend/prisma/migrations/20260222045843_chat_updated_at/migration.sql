-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");
