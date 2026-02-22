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
  return this.prisma.$transaction(async (tx) => {
    await this.ensureMember(userId, chatId);

    const msg = await tx.message.create({
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

    await tx.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });
}

  async listMessages(userId: number, chatId: number, cursor?: number, take = 30) {
  await this.ensureMember(userId, chatId);

  const items = await this.prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'desc' }, // берём “с конца”
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, chatId: true, text: true, createdAt: true,
      author: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
    },
  });

  const nextCursor = items.length === take ? items[items.length - 1].id : null;
  return { items, nextCursor };
}
}