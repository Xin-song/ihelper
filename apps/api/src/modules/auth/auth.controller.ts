import { Body, Controller, Get, HttpCode, Patch, Post, Res } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, RequestUser } from './decorators/current-user.decorator';
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_MS } from './auth.constants';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);
    res.cookie(AUTH_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: AUTH_TOKEN_TTL_MS });
    return user;
  }

  /** 公开：本来就没登录时点退出也不该报错 */
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.getPublicProfile(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto.displayName);
  }

  @Post('password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
