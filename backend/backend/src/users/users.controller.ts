import { Controller, Get, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    getUsers() {
        return this.usersService.getAll();
    }

    @Post()
    createUser(@Body() body: CreateUserDto){
        return body;
    }
}
