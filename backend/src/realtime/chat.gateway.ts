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
      const token = socket.handshake.auth?.token;

      if (!token) {
        throw new Error('No token provided');
      }

      const payload = this.jwtService.verify(token);

      // сохраняем userId в сокет
      socket.data.userId = payload.sub;

      console.log('WS connected user:', payload.sub);
    } catch (error) {
    console.log('WS auth failed:', error?.message || error);
    socket.disconnect();
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

  
  emitNewMessage(chatId: number, payload: any) {
    this.server.to(`chat:${chatId}`).emit('new_message', payload);
  }
}