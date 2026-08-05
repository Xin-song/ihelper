import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FindTasksDto } from './dto/find-tasks.dto';

type RawTask = {
  dueAt: Date | null;
  status: string;
  archivedAt: Date | null;
  [key: string]: unknown;
};

/** isOverdue / isArchived 都是纯派生字段，不单独暴露内部时间戳语义给前端猜 */
function serialize<T extends RawTask>(task: T) {
  const isOverdue =
    task.dueAt !== null &&
    task.dueAt.getTime() < Date.now() &&
    task.status !== 'done' &&
    task.status !== 'cancelled';
  return { ...task, isOverdue, isArchived: task.archivedAt !== null };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: FindTasksDto) {
    const tasks = await this.prisma.task.findMany({
      where: {
        spaceId: DEFAULT_SPACE_ID,
        userId,
        deletedAt: null,
        status: query.status,
        topicId: query.topicId,
        dueAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    return tasks.map(serialize);
  }

  async findOne(id: string, userId: string) {
    return serialize(await this.assertExists(id, userId));
  }

  async create(dto: CreateTaskDto, userId: string) {
    const created = await this.prisma.task.create({
      data: {
        spaceId: DEFAULT_SPACE_ID,
        userId,
        title: dto.title,
        description: dto.description,
        topicId: dto.topicId,
        dueAt: dto.dueAt,
        priority: dto.priority,
        status: dto.status,
        tags: dto.tags,
      },
    });
    return serialize(created);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.assertExists(id, userId);
    /** 状态切到 done 时打上完成时间；从 done 切回其他状态时清掉，允许「误标完成」撤回 */
    const completedAt =
      dto.status === 'done' && existing.status !== 'done'
        ? new Date()
        : dto.status && dto.status !== 'done'
          ? null
          : undefined;
    /** archived 三态推导，同 completedAt 的写法：true→打时间戳，false→清空，未传→不改动 */
    const archivedAt =
      dto.archived === true ? new Date() : dto.archived === false ? null : undefined;

    const resultingStart =
      dto.scheduledStartAt === undefined ? existing.scheduledStartAt : dto.scheduledStartAt;
    const resultingEnd =
      dto.scheduledEndAt === undefined ? existing.scheduledEndAt : dto.scheduledEndAt;
    if (
      resultingStart &&
      resultingEnd &&
      new Date(resultingEnd).getTime() < new Date(resultingStart).getTime()
    ) {
      throw new BadRequestException('时间轴结束时间不能早于开始时间');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        topicId: dto.topicId,
        dueAt: dto.dueAt,
        priority: dto.priority,
        status: dto.status,
        tags: dto.tags,
        completedAt,
        archivedAt,
        scheduledStartAt: dto.scheduledStartAt,
        scheduledEndAt: dto.scheduledEndAt,
      },
    });
    return serialize(updated);
  }

  async remove(id: string, userId: string) {
    await this.assertExists(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  private async assertExists(id: string, userId: string) {
    const found = await this.prisma.task.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!found) throw new NotFoundException(`待办 ${id} 不存在`);
    return found;
  }
}
