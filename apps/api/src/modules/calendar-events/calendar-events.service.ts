import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FindEventsDto } from './dto/find-events.dto';

@Injectable()
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 范围查询：起止区间与 [from, to] 有重叠即返回，覆盖跨天事件 */
  async findAll(userId: string, query: FindEventsDto) {
    return this.prisma.calendarEvent.findMany({
      where: {
        spaceId: DEFAULT_SPACE_ID,
        userId,
        deletedAt: null,
        startAt: query.to ? { lte: query.to } : undefined,
        endAt: query.from ? { gte: query.from } : undefined,
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    return this.assertExists(id, userId);
  }

  async create(dto: CreateEventDto, userId: string) {
    this.assertValidRange(dto.startAt, dto.endAt);
    return this.prisma.calendarEvent.create({
      data: {
        spaceId: DEFAULT_SPACE_ID,
        userId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: dto.startAt,
        endAt: dto.endAt,
        allDay: dto.allDay,
      },
    });
  }

  async update(id: string, dto: UpdateEventDto, userId: string) {
    const existing = await this.assertExists(id, userId);
    this.assertValidRange(
      dto.startAt ?? existing.startAt.toISOString(),
      dto.endAt ?? existing.endAt.toISOString(),
    );
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: dto.startAt,
        endAt: dto.endAt,
        allDay: dto.allDay,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertExists(id, userId);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  private assertValidRange(startAt: string, endAt: string) {
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw new BadRequestException('结束时间不能早于开始时间');
    }
  }

  private async assertExists(id: string, userId: string) {
    const found = await this.prisma.calendarEvent.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!found) throw new NotFoundException(`日程事件 ${id} 不存在`);
    return found;
  }
}
