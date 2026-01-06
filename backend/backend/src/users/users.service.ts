import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
    getAll(): CreateUserDto[] {
        return [
            {id: 1, name: 'DanyaNeRat'},
            {id: 2, name: 'LadaRat'},
        ];
    }
}
