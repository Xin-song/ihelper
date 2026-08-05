import { IsInt, IsOptional, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskTopicDto } from './create-task-topic.dto';

export class UpdateTaskTopicDto extends PartialType(CreateTaskTopicDto) {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
