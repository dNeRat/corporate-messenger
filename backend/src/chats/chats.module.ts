import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsReadController } from './chats.read.controller';

@Module({
  controllers: [ChatsController, ChatsReadController], 
  providers: [ChatsService]
})
export class ChatsModule {}
