import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  /** bcrypt 只认前 72 字节，超出部分会被静默截断，上限按字节数留够余量 */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
