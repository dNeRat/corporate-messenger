import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
  private readonly authService: AuthService,
  private readonly prisma: PrismaService,
) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }


@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

  @UseGuards(JwtAuthGuard)
@Get('me')
async me(@Req() req: Request & { user: any }) {
  const userId = req.user.sub;

  return this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true, profile: true },
  });
}
}
