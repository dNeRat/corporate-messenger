-- AlterTable
ALTER TABLE "MessageMention" ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MessageMention_userId_readAt_idx" ON "MessageMention"("userId", "readAt");
