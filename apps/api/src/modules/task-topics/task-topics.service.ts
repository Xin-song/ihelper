import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskTopicDto } from './dto/create-task-topic.dto';
import { UpdateTaskTopicDto } from './dto/update-task-topic.dto';

@Injectable()
export class TaskTopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.taskTopic.findMany({
      where: { spaceId: DEFAULT_SPACE_ID, userId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string, userId: string) {
    return this.assertExists(id, userId);
  }

  async create(dto: CreateTaskTopicDto, userId: string) {
    return this.prisma.taskTopic.create({
      data: {
        spaceId: DEFAULT_SPACE_ID,
        userId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async update(id: string, dto: UpdateTaskTopicDto, userId: string) {
    await this.assertExists(id, userId);
    return this.prisma.taskTopic.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
        sortOrder: dto.sortOrder,
      },
    });
  }

  /** 删除主题即删除文件夹：连同它名下未删除的待办事项一并软删 */
  async remove(id: string, userId: string) {
    await this.assertExists(id, userId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { topicId: id, userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.taskTopic.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);
    return { id };
  }

  private async assertExists(id: string, userId: string) {
    const found = await this.prisma.taskTopic.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!found) throw new NotFoundException(`待办主题 ${id} 不存在`);
    return found;
  }
}
