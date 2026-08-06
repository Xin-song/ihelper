import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PASSWORD_SALT_ROUNDS = 10;
/** Prisma 唯一约束冲突的错误码，用来把 email 重复转成友好的 409 */
const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}

function toPublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
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

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          displayName: dto.displayName,
          email: dto.email,
          bio: dto.bio,
          avatarUrl: dto.avatarUrl,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_ERROR_CODE
      ) {
        throw new ConflictException('邮箱已被占用');
      }
      throw error;
    }
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

  /** 个人信息页「数据总览」：跨模块聚合只读统计，不属于任何单个业务模块，放在这里最合适 */
  async getStats(userId: string) {
    const [user, recipeCount, submissionCount, taskTotalCount, taskDoneCount, stockItemCount] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
        this.prisma.recipe.count({ where: { authorId: userId, deletedAt: null } }),
        this.prisma.recipeSubmission.count({ where: { userId, deletedAt: null } }),
        this.prisma.task.count({ where: { userId, deletedAt: null } }),
        this.prisma.task.count({ where: { userId, deletedAt: null, status: 'done' } }),
        // 库存是空间级数据，没有 userId 字段，见 schema.prisma StockItem
        this.prisma.stockItem.count({ where: { deletedAt: null } }),
      ]);
    const daysSinceJoined = Math.max(
      0,
      Math.floor((Date.now() - user.createdAt.getTime()) / MS_PER_DAY),
    );
    return { recipeCount, submissionCount, taskDoneCount, taskTotalCount, stockItemCount, daysSinceJoined };
  }

  /**
   * 「数据主权」承诺的起点：一键导出这个用户名下的全部数据。库存/食材是空间级数据，
   * 不是「这个用户的」，不包含在内；导出格式只服务于这个接口，不复用列表/详情接口的 DTO 形状。
   */
  async exportMyData(userId: string) {
    const [profile, recipes, submissions, tasks, taskTopics, calendarEvents] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }).then(toPublicUser),
      this.prisma.recipe.findMany({
        where: { authorId: userId, deletedAt: null },
        include: {
          recipeIngredients: { include: { ingredient: true } },
          printImages: true,
        },
      }),
      this.prisma.recipeSubmission.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.task.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.taskTopic.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.calendarEvent.findMany({ where: { userId, deletedAt: null } }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      recipes,
      submissions,
      tasks,
      taskTopics,
      calendarEvents,
    };
  }

  /** 注销账号：软删除，删除后 login/getPublicProfile/JwtStrategy 统一按 deletedAt: null 过滤，账号自动失效 */
  async deleteAccount(id: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('密码不正确');
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
