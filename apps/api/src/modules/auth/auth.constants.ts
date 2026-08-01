export const AUTH_COOKIE_NAME = 'ihelper_token';
export const AUTH_TOKEN_TTL = '7d';
export const AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 缺失时直接让启动失败，好过悄悄用一个不安全的默认值签发 token */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('环境变量 JWT_SECRET 未设置，登录功能无法启动');
  }
  return secret;
}
