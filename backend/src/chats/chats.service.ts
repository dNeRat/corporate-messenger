import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChat(currentUserId: number, dto: CreateChatDto) {
    // Личный чат: ровно 1 собеседник + текущий = 2 участника
    if (!dto.isGroup) {
      if (dto.memberIds.length !== 1) {
        throw new ForbiddenException('Direct chat must have exactly 1 memberId');
      }

      const otherUserId = dto.memberIds[0];

      // Попробуем найти уже существующий direct-чат между этими двумя
      const existing = await this.prisma.chat.findFirst({
        where: {
          isGroup: false,
          members: {
            some: { userId: currentUserId },
          },
          AND: {
            members: {
              some: { userId: otherUserId },
            },
          },
        },
        select: { id: true },
      });

      if (existing) return { chatId: existing.id, reused: true };
    }

    // Участники (добавляем себя всегда)
    const uniqueUserIds = Array.from(new Set([currentUserId, ...dto.memberIds]));

    const chat = await this.prisma.chat.create({
      data: {
        title: dto.title,
        isGroup: dto.isGroup,
        members: {
          create: uniqueUserIds.map((userId) => ({
            userId,
            role: userId === currentUserId ? 'OWNER' : 'MEMBER',
          })),
        },
      },
      select: { id: true, title: true, isGroup: true, createdAt: true },
    });

    return { chat, reused: false };
  }

  async listMyChats(currentUserId: number) {
    return this.prisma.chat.findMany({
      where: {
        members: { some: { userId: currentUserId } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        isGroup: true,
        createdAt: true,
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });
  }

  async getChatById(currentUserId: number, chatId: number) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        title: true,
        isGroup: true,
        createdAt: true,
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    const isMember = chat.members.some((m) => m.userId === currentUserId);
    if (!isMember) throw new ForbiddenException('You are not a member of this chat');

    return chat;
  }
}