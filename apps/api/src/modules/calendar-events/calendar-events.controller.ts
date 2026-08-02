import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CalendarEventsService } from './calendar-events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FindEventsDto } from './dto/find-events.dto';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';

/** 日程事件是私人数据，整个模块都要登录，按 userId 过滤，见 auth 模块的全局 Guard */
@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  findAll(@Query() query: FindEventsDto, @CurrentUser() user: RequestUser) {
    return this.calendarEventsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.calendarEventsService.findOne(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.calendarEventsService.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: RequestUser) {
    return this.calendarEventsService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.calendarEventsService.remove(id, user.id);
  }
}
