import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers() {
    return this.usersService.getAll();
  }

  @Post()
  async createUser(@Body() body: { email: string; password: string }) {
    return this.usersService.create(body.email, body.password);
  }
}
