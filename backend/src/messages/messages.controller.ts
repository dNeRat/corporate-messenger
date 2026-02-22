import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';


@Controller('chats/:id/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  send(@Req() req: any, @Param('id', ParseIntPipe) chatId: number, @Body() dto: CreateMessageDto) {
    return this.messagesService.sendMessage(req.user.sub, chatId, dto);
  }

  @Get()
  list(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.messagesService.listMessages(req.user.sub, chatId, cursor ? Number(cursor) : undefined, take ? Number(take) : 30);
  }
}