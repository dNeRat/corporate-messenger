import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MentionsController } from './mentions.controller';
import { ChatGateway } from '../realtime/chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule], 
  controllers: [MessagesController, MentionsController],
  providers: [MessagesService, ChatGateway],
})
export class MessagesModule {}
