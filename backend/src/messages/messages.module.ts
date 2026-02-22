import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ChatGateway } from '../realtime/chat.gateway';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, ChatGateway],
})
export class MessagesModule {}