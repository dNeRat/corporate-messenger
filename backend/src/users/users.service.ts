import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';


type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  position?: string;
  department?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
            position: true,
            department: true,
          },
        },
      },
    });
  }

  async create(data: CreateUserInput) {
  const passwordHash = await bcrypt.hash(data.password, 10);

  return this.prisma.user.create({
    data: {
      email: data.email,
      passwordHash, // ✅ вместо password
      profile: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          avatarUrl: data.avatarUrl,
          position: data.position,
          department: data.department,
        },
      },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          position: true,
          department: true,
        },
      },
    },
  });
  }
}
