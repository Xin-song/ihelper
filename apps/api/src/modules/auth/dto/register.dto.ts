import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{3,32}$/, {
    message: '用户名只能包含字母、数字、下划线和短横线，长度 3-32 位',
  })
  username!: string;

  /** bcrypt 只认前 72 字节，超出部分会被静默截断，上限按字节数留够余量 */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  /** 是否等于 password 在 Controller 里校验——跨字段校验放 DTO 装饰器里比较绕 */
  @IsString()
  confirmPassword!: string;
}
