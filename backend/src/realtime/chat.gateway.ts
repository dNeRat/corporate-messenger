import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join_chat')
  handleJoin(@MessageBody() data: { chatId: number }, @ConnectedSocket() socket: Socket) {
    socket.join(`chat:${data.chatId}`);
    return { joined: data.chatId };
  }

  emitNewMessage(chatId: number, payload: any) {
    this.server.to(`chat:${chatId}`).emit('new_message', payload);
  }
}