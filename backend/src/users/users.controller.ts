import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchUsers(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const parsed = Number(limitRaw);
    const limit = Number.isFinite(parsed) ? parsed : 20;
    return this.usersService.search(req.user.sub, q, limit);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async getUsers() {
    return this.usersService.getAll();
  }


}
