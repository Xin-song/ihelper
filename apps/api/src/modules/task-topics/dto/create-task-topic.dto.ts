import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTaskTopicDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
