import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateChatDto) {
    return this.chatsService.createChat(req.user.sub, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.chatsService.listMyChats(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.chatsService.getChatById(req.user.sub, id);
  }
}