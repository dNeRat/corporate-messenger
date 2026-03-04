-- AlterTable
ALTER TABLE "Chat"
ADD COLUMN "directUserAId" INTEGER,
ADD COLUMN "directUserBId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_directUserAId_directUserBId_key" ON "Chat"("directUserAId", "directUserBId");
