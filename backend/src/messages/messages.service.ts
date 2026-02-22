import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureMember(userId: number, chatId: number) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this chat');
  }

  async sendMessage(userId: number, chatId: number, dto: CreateMessageDto) {
    await this.ensureMember(userId, chatId);

    return this.prisma.message.create({
      data: {
        chatId,
        authorId: userId,
        text: dto.text,
      },
      select: {
        id: true,
        chatId: true,
        text: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async listMessages(userId: number, chatId: number) {
    await this.ensureMember(userId, chatId);

    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        chatId: true,
        text: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }
}