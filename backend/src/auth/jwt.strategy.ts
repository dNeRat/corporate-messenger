import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const cookieExtractor = (req: any): string | null => {
  return req?.cookies?.access_token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'dev_secret_change_me',
    });
  }

  validate(payload: { sub: number; email: string; role: string }) {
    return payload; // попадёт в req.user
  }
}