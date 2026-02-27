import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { SetMemberRoleDto } from './dto/set-member-role.dto';

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

  @Patch(':id')
  updateChat(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChatDto,
  ) {
    return this.chatsService.updateChat(req.user.sub, id, dto);
  }

  @Post(':id/members')
  addMembers(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMembersDto,
  ) {
    return this.chatsService.addMembers(req.user.sub, id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.chatsService.removeMember(req.user.sub, id, userId);
  }

  @Patch(':id/members/:userId/role')
  setMemberRole(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetMemberRoleDto,
  ) {
    return this.chatsService.setMemberRole(req.user.sub, id, userId, dto);
  }

  @Get(':id/pins')
  listPins(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.chatsService.listPins(req.user.sub, id);
  }

  @Post(':id/pins/:messageId')
  pinMessage(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.chatsService.pinMessage(req.user.sub, id, messageId);
  }

  @Delete(':id/pins/:messageId')
  unpinMessage(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.chatsService.unpinMessage(req.user.sub, id, messageId);
  }
}
