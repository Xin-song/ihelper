import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

const PASSWORD_SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  createdAt: Date;
}

function toPublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { username, deletedAt: null } });
    const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !matches) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return { token: this.signToken(user), user: toPublicUser(user) };
  }

  /** 昵称默认等于用户名，注册时不额外收集，个人信息页里随时能改 */
  async register(username: string, password: string) {
    const existing = await this.prisma.user.findFirst({ where: { username } });
    if (existing) {
      throw new ConflictException('用户名已被占用');
    }
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { username, passwordHash, displayName: username },
    });
    return { token: this.signToken(user), user: toPublicUser(user) };
  }

  private signToken(user: { id: string; username: string }) {
    return this.jwt.sign({ sub: user.id, username: user.username });
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id, deletedAt: null } });
    return toPublicUser(user);
  }

  async updateProfile(id: string, displayName: string): Promise<PublicUser> {
    const user = await this.prisma.user.update({ where: { id }, data: { displayName } });
    return toPublicUser(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('当前密码不正确');
    }
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
