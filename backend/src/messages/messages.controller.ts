import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';


@Controller('chats/:id/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  send(@Req() req: any, @Param('id', ParseIntPipe) chatId: number, @Body() dto: CreateMessageDto) {
    return this.messagesService.sendMessage(req.user.sub, chatId, dto);
  }

  @Patch(':messageId')
  edit(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.editMessage(req.user.sub, chatId, messageId, dto);
  }

  @Delete(':messageId')
  remove(
    @Req() req: any,
    @Param('id', ParseIntPipe) chatId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.messagesService.deleteMessage(req.user.sub, chatId, messageId);
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
