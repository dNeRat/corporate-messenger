import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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
}
