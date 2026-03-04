import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { SetMemberRoleDto } from './dto/set-member-role.dto';
import { CreateGroupChatDto } from './dto/create-group-chat.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMembership(userId: number, chatId: number) {
    return this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { userId: true, role: true },
    });
  }

  private async ensureMember(userId: number, chatId: number) {
    const membership = await this.getMembership(userId, chatId);
    if (!membership) throw new ForbiddenException('You are not a member of this chat');
    return membership;
  }

  private async ensureRole(userId: number, chatId: number, roles: string[]) {
    const membership = await this.ensureMember(userId, chatId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission');
    }
    return membership;
  }

  private async ensureGroupChat(chatId: number) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, isGroup: true },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.isGroup) throw new ForbiddenException('Only group chats are supported');
    return chat;
  }

  private async ensureUsersExist(userIds: number[]) {
    const uniqueUserIds = Array.from(new Set(userIds));
    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true },
    });

    if (existingUsers.length !== uniqueUserIds.length) {
      const existingIds = new Set(existingUsers.map((u) => u.id));
      const missing = uniqueUserIds.filter((id) => !existingIds.has(id));
      throw new ForbiddenException(`Users not found: ${missing.join(', ')}`);
    }
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }

  private sortDirectPair(userA: number, userB: number) {
    return userA < userB ? [userA, userB] : [userB, userA];
  }

  async createDirectChat(currentUserId: number, otherUserId: number) {
    if (!otherUserId || !Number.isInteger(otherUserId) || otherUserId < 1) {
      throw new BadRequestException('Invalid userId');
    }
    if (Number(otherUserId) === Number(currentUserId)) {
      throw new BadRequestException('Cannot create direct chat with yourself');
    }

    await this.ensureUsersExist([currentUserId, otherUserId]);

    const [directUserAId, directUserBId] = this.sortDirectPair(
      currentUserId,
      otherUserId,
    );

    const existingByPair = await this.prisma.chat.findUnique({
      where: { directUserAId_directUserBId: { directUserAId, directUserBId } },
      select: { id: true },
    });
    if (existingByPair) return { chatId: existingByPair.id, reused: true };

    const legacyDirect = await this.prisma.chat.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: otherUserId } } },
          { members: { every: { userId: { in: [currentUserId, otherUserId] } } } },
        ],
      },
      select: { id: true, directUserAId: true, directUserBId: true },
    });

    if (legacyDirect) {
      if (!legacyDirect.directUserAId || !legacyDirect.directUserBId) {
        try {
          await this.prisma.chat.update({
            where: { id: legacyDirect.id },
            data: { directUserAId, directUserBId },
          });
        } catch (error) {
          if (!this.isUniqueViolation(error)) throw error;
        }
      }

      const normalized = await this.prisma.chat.findUnique({
        where: { directUserAId_directUserBId: { directUserAId, directUserBId } },
        select: { id: true },
      });
      return { chatId: normalized?.id ?? legacyDirect.id, reused: true };
    }

    try {
      const chat = await this.prisma.chat.create({
        data: {
          isGroup: false,
          directUserAId,
          directUserBId,
          members: {
            create: [directUserAId, directUserBId].map((userId) => ({
              userId,
              role: userId === currentUserId ? 'OWNER' : 'MEMBER',
            })),
          },
        },
        select: { id: true },
      });
      return { chatId: chat.id, reused: false };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      const chat = await this.prisma.chat.findUnique({
        where: { directUserAId_directUserBId: { directUserAId, directUserBId } },
        select: { id: true },
      });
      if (!chat) throw error;
      return { chatId: chat.id, reused: true };
    }
  }

  async createGroupChat(currentUserId: number, dto: CreateGroupChatDto) {
    const uniqueUserIds = Array.from(new Set([currentUserId, ...dto.memberIds]));
    await this.ensureUsersExist(uniqueUserIds);

    const chat = await this.prisma.chat.create({
      data: {
        title: dto.title,
        isGroup: true,
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
  async createChat(currentUserId: number, dto: CreateChatDto) {
    if (dto.isGroup) {
      return this.createGroupChat(currentUserId, {
        title: dto.title,
        memberIds: dto.memberIds,
      });
    }

    if (dto.memberIds.length !== 1) {
      throw new BadRequestException('Direct chat must have exactly 1 memberId');
    }
    return this.createDirectChat(currentUserId, dto.memberIds[0]);
  }

  async listMyChats(currentUserId: number) {
  const chats = await this.prisma.chat.findMany({
    where: { members: { some: { userId: currentUserId } } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      isGroup: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              presenceStatus: true,
              lastSeenAt: true,
              profile: {
                select: { firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          text: true,
          createdAt: true,
        },
      },
    },
  });

  return chats.map((chat) => {
  if (!chat.isGroup) {
    const companionMember = chat.members.find((m) => m.userId !== currentUserId);

    const { members, ...rest } = chat;
    return {
      ...rest,
      companion: companionMember?.user ?? null,
    };
  }

  return chat;
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
                presenceStatus: true,
                lastSeenAt: true,
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

  async updateChat(currentUserId: number, chatId: number, dto: UpdateChatDto) {
    await this.ensureRole(currentUserId, chatId, ['OWNER', 'ADMIN']);

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, isGroup: true },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.isGroup) throw new ForbiddenException('Only group chats can be updated');

    return this.prisma.chat.update({
      where: { id: chatId },
      data: { title: dto.title },
      select: { id: true, title: true, isGroup: true, updatedAt: true },
    });
  }

  async addMembers(currentUserId: number, chatId: number, dto: AddMembersDto) {
    await this.ensureRole(currentUserId, chatId, ['OWNER', 'ADMIN']);

    const uniqueUserIds = Array.from(new Set(dto.memberIds));
    await this.ensureUsersExist(uniqueUserIds);

    const existingMembers = await this.prisma.chatMember.findMany({
      where: { chatId, userId: { in: uniqueUserIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existingMembers.map(m => m.userId));
    const toAdd = uniqueUserIds.filter(id => !existingSet.has(id));

    if (toAdd.length === 0) return { added: 0 };

    await this.prisma.chatMember.createMany({
      data: toAdd.map((userId) => ({ chatId, userId, role: 'MEMBER' })),
    });

    return { added: toAdd.length };
  }

  async removeMember(currentUserId: number, chatId: number, memberId: number) {
    const current = await this.ensureRole(currentUserId, chatId, ['OWNER', 'ADMIN']);

    const target = await this.getMembership(memberId, chatId);
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'OWNER' && current.role !== 'OWNER') {
      throw new ForbiddenException('Only owner can remove owner');
    }

    if (target.role === 'OWNER') {
      throw new ForbiddenException('Owner cannot be removed');
    }

    await this.prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId: memberId } },
    });

    return { removed: true };
  }

  async setMemberRole(
    currentUserId: number,
    chatId: number,
    memberId: number,
    dto: SetMemberRoleDto,
  ) {
    await this.ensureRole(currentUserId, chatId, ['OWNER']);

    const target = await this.getMembership(memberId, chatId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') {
      throw new ForbiddenException('Owner role cannot be changed');
    }

    return this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: memberId } },
      data: { role: dto.role },
      select: { userId: true, role: true },
    });
  }

  async listPins(currentUserId: number, chatId: number) {
    await this.ensureMember(currentUserId, chatId);
    await this.ensureGroupChat(chatId);

    return this.prisma.messagePin.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messageId: true,
        createdAt: true,
        pinnedBy: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        message: {
          select: {
            id: true,
            text: true,
            createdAt: true,
            deletedAt: true,
            author: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  async pinMessage(currentUserId: number, chatId: number, messageId: number) {
    await this.ensureMember(currentUserId, chatId);
    await this.ensureGroupChat(chatId);

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true },
    });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.messagePin.deleteMany({ where: { chatId } });

      return tx.messagePin.create({
        data: { chatId, messageId, pinnedById: currentUserId },
        select: { id: true, messageId: true },
      });
    });
  }

  async unpinMessage(currentUserId: number, chatId: number, messageId: number) {
    await this.ensureMember(currentUserId, chatId);
    await this.ensureGroupChat(chatId);

    await this.prisma.messagePin.delete({
      where: { chatId_messageId: { chatId, messageId } },
    });

    return { ok: true };
  }
}
