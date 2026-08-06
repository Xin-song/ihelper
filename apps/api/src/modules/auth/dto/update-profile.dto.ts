import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  /** 昵称，展示用 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  displayName?: string;

  /** 传 null 清空邮箱/简介/头像，传 undefined（不传这个 key）表示不改动，IsOptional 对两者都放行 */
  @IsOptional()
  @IsEmail()
  email?: string | null;

  /** 一句话简介 */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}
