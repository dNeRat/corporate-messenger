import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as cookie from 'cookie';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  // Проверка JWT при подключении
  async handleConnection(socket: Socket) {
  try {
    // пробуем token из handshake.auth
    let token: string | undefined = socket.handshake.auth?.token;

    // если нет - пробуем достать из Cookie заголовка
    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (cookieHeader) {
        const parsed = cookie.parse(cookieHeader);
        token = parsed['access_token'];
      }
    }

    if (!token) throw new Error('No token (auth.token or access_token cookie)');

    const payload = this.jwtService.verify(token);
    socket.data.userId = payload.sub;

    console.log('WS connected user:', payload.sub);
  } catch (error: any) {
    console.log('WS auth failed:', error?.message || error);
    socket.disconnect(true);
  }
}

  handleDisconnect(socket: Socket) {
    console.log('WS disconnected:', socket.id);
  }

  // Проверка, что пользователь участник чата
  @SubscribeMessage('join_chat')
  async handleJoin(
    @MessageBody() data: { chatId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.userId;

    if (!userId) return;

    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: data.chatId,
          userId,
        },
      },
    });

    if (!membership) {
      socket.emit('error', 'Not a member of this chat');
      return;
    }

    socket.join(`chat:${data.chatId}`);
    return { joined: data.chatId };
  }

  private async getUserLabel(userId: number) {
  const u = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  const name = [u?.profile?.firstName, u?.profile?.lastName].filter(Boolean).join(' ');
  return name || u?.email || `User ${userId}`;
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { chatId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.userId;
    if (!userId) return;

    const label = await this.getUserLabel(userId);
    socket.to(`chat:${data.chatId}`).emit('typing', { chatId: data.chatId, userId, label });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @MessageBody() data: { chatId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.userId;
    if (!userId) return;

    socket.to(`chat:${data.chatId}`).emit('stop_typing', { chatId: data.chatId, userId });
  }

  @SubscribeMessage("mark_read")
async handleMarkRead(@MessageBody() data: { chatId: number }, @ConnectedSocket() socket: any) {
  const userId = Number(socket.data.userId);
  const chatId = Number(data.chatId);
  if (!userId || !chatId) return;

  const row = await this.prisma.chatRead.upsert({
    where: { chatId_userId: { chatId, userId } },
    update: { lastReadAt: new Date() },
    create: { chatId, userId, lastReadAt: new Date() },
  });

  socket.to(`chat:${chatId}`).emit("read_receipt", {
    chatId,
    userId,
    lastReadAt: row.lastReadAt,
  });
}

  emitNewMessage(chatId: number, payload: any) {
    this.server.to(`chat:${chatId}`).emit('new_message', payload);
  }

  emitMessageUpdated(chatId: number, payload: any) {
    this.server.to(`chat:${chatId}`).emit('message_updated', payload);
  }

  emitMessageDeleted(chatId: number, payload: any) {
    this.server.to(`chat:${chatId}`).emit('message_deleted', payload);
  }
}
