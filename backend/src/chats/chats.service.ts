import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { SetMemberRoleDto } from './dto/set-member-role.dto';

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

    // Проверяем, что все userId существуют
    const existingUsers = await this.prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true },
    });

    if (existingUsers.length !== uniqueUserIds.length) {
    const existingIds = new Set(existingUsers.map(u => u.id));
    const missing = uniqueUserIds.filter(id => !existingIds.has(id));
    throw new ForbiddenException(`Users not found: ${missing.join(', ')}`);
    }

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
    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true },
    });

    if (existingUsers.length !== uniqueUserIds.length) {
      const existingIds = new Set(existingUsers.map(u => u.id));
      const missing = uniqueUserIds.filter(id => !existingIds.has(id));
      throw new ForbiddenException(`Users not found: ${missing.join(', ')}`);
    }

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
}
