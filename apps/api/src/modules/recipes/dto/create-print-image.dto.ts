import { IsIn, IsString, MinLength } from 'class-validator';
import { PRINT_ORIENTATIONS, PrintOrientation } from '@ihelper/shared';

export class CreatePrintImageDto {
  /** 已经通过 /uploads/images 传上去拿到的 URL */
  @IsString()
  @MinLength(1)
  url!: string;

  @IsIn(PRINT_ORIENTATIONS)
  orientation!: PrintOrientation;
}
