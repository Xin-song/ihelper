import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  /** 昵称，展示用 */
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  displayName!: string;
}
