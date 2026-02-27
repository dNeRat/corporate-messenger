import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatGateway } from 'src/realtime/chat.gateway';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private async ensureMember(userId: number, chatId: number) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { id: true, role: true },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this chat');
    return membership;
  }

  async sendMessage(userId: number, chatId: number, dto: CreateMessageDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureMember(userId, chatId);

      if (dto.replyToId) {
        const exists = await tx.message.findUnique({
          where: { id: dto.replyToId },
          select: { id: true, chatId: true },
        });
        if (!exists || exists.chatId !== chatId) {
          throw new NotFoundException('Reply message not found');
        }
      }

      const msg = await tx.message.create({
        data: {
          chatId,
          authorId: userId,
          text: dto.text,
          replyToId: dto.replyToId,
        },
        select: {
          id: true,
          chatId: true,
          text: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
          replyTo: {
            select: {
              id: true,
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
          },
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

      this.chatGateway.emitNewMessage(chatId, msg);
      return msg;
    });
  }

  async listMessages(userId: number, chatId: number, cursor?: number, take = 30) {
    await this.ensureMember(userId, chatId);

    const items = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        chatId: true,
        text: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        replyTo: {
          select: {
            id: true,
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
        },
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    const nextCursor = items.length === take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  async editMessage(userId: number, chatId: number, messageId: number, dto: UpdateMessageDto) {
    await this.ensureMember(userId, chatId);

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, authorId: true, deletedAt: true },
    });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');
    if (msg.deletedAt) throw new ForbiddenException('Message is deleted');
    if (msg.authorId !== userId) throw new ForbiddenException('Only author can edit message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text: dto.text, editedAt: new Date() },
      select: {
        id: true,
        chatId: true,
        text: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        replyTo: {
          select: {
            id: true,
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
        },
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    this.chatGateway.emitMessageUpdated(chatId, updated);
    return updated;
  }

  async deleteMessage(userId: number, chatId: number, messageId: number) {
    const membership = await this.ensureMember(userId, chatId);

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, authorId: true, deletedAt: true },
    });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');
    if (msg.deletedAt) return { ok: true };

    const canDelete =
      msg.authorId === userId || membership.role === 'OWNER' || membership.role === 'ADMIN';
    if (!canDelete) throw new ForbiddenException('No permission to delete message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), text: '' },
      select: {
        id: true,
        chatId: true,
        text: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    });

    this.chatGateway.emitMessageDeleted(chatId, updated);
    return updated;
  }
}
