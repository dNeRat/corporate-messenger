import { Controller, Post, Param, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("chats")
export class ChatsReadController {
  constructor(private prisma: PrismaService) {}

  @Post(":id/read")
  async markRead(@Param("id") id: string, @Req() req: any) {
    const chatId = Number(id);
    const userId = Number(req.user.sub);

    const row = await this.prisma.chatRead.upsert({
      where: { chatId_userId: { chatId, userId } },
      update: { lastReadAt: new Date() },
      create: { chatId, userId, lastReadAt: new Date() },
    });

    return row;
  }
}