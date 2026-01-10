import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, email: true, createdAt: true }, // пароль не отдаём
    });
  }

  async create(email: string, password: string) {
    return this.prisma.user.create({
      data: { email, password },
      select: { id: true, email: true, createdAt: true },
    });
  }
}
