import { Controller, Param, Req, UseGuards, Get, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("chats")
export class ChatsReadController {
  constructor(private prisma: PrismaService) {}

  @Get(":id/read")
  getRead(@Param("id") id: string) {
    const chatId = Number(id);
    return this.prisma.chatRead.findMany({
      where: { chatId },
      select: { userId: true, lastReadAt: true },
    });
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @Req() req: any) {
    const chatId = Number(id);
    const userId = Number(req.user.sub);

    return this.prisma.chatRead.upsert({
      where: { chatId_userId: { chatId, userId } },
      update: { lastReadAt: new Date() },
      create: { chatId, userId, lastReadAt: new Date() },
    });
  }
}