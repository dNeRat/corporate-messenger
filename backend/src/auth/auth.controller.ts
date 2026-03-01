import { Body, Controller, Get, Post, Req, UseGuards, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
  private readonly authService: AuthService,
  private readonly prisma: PrismaService,
) {}

  @Post('register')
async register(
  @Body() dto: RegisterDto,
  @Res({ passthrough: true }) res: Response,
) {
  const { accessToken, user } = await this.authService.register(dto);

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: false, // true только на https
    sameSite: 'lax',
  });

  return { user };
}


@Post('login')
async login(
  @Body() dto: LoginDto,
  @Res({ passthrough: true }) res: Response,
) {
  const { accessToken, user } = await this.authService.login(dto);

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: false, // true только на https
    sameSite: 'lax',
  });

  return { user };
}

  @UseGuards(JwtAuthGuard)
@Get('me')
async me(@Req() req: Request & { user: any }) {
  const userId = req.user.sub;

  return this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true, presenceStatus: true, lastSeenAt: true, profile: true },
  });
}

@Post('logout')
logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: false, // true только на https
    sameSite: 'lax',
  });
  return { ok: true };
}
}
