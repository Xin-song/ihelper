import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUTH_COOKIE_NAME, getJwtSecret } from '../auth.constants';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[AUTH_COOKIE_NAME] ?? null;
}

interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /** passport-jwt 只验证签名和过期时间，用户是否还存在/被软删要自己查 */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, username: true, displayName: true },
    });
    if (!user) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    return user;
  }
}
