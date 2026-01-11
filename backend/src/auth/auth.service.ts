import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signToken(userId: number, email: string) {
    return this.jwt.sign({ sub: userId, email });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            avatarUrl: dto.avatarUrl,
            position: dto.position,
            department: dto.department,
          },
        },
      },
      select: { id: true, email: true, profile: true },
    });

    const accessToken = this.signToken(user.id, user.email);
    return { user, accessToken };
  }

async login(dto: LoginDto) {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
    select: { id: true, email: true, passwordHash: true, createdAt: true, profile: true },
  });

  if (!user) throw new UnauthorizedException('Invalid credentials');

  const ok = await bcrypt.compare(dto.password, user.passwordHash);
  if (!ok) throw new UnauthorizedException('Invalid credentials');

  const accessToken = this.signToken(user.id, user.email);

  const { passwordHash, ...safeUser } = user;
  return { user: safeUser, accessToken };
}
}
