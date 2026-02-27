import { Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('mentions')
@UseGuards(JwtAuthGuard)
export class MentionsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.messagesService.listMentions(
      req.user.sub,
      cursor ? Number(cursor) : undefined,
      take ? Number(take) : 30,
    );
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.messagesService.getUnreadMentionsCount(req.user.sub).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.messagesService.markMentionRead(req.user.sub, id);
  }
}
