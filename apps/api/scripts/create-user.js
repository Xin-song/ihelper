#!/usr/bin/env node
/**
 * 自托管场景不做公开注册（见迁移 20260801140640 的注释），
 * 账号只能由持有服务器权限的人用这个脚本建。
 *
 * 用法：node scripts/create-user.js --username=xxx --password=xxx --nickname=xxx [--email=xxx]
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const PASSWORD_SALT_ROUNDS = 10;

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const match = raw.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function main() {
  const { username, password, nickname, email } = parseArgs();
  if (!username || !password || !nickname) {
    console.error(
      '用法：node scripts/create-user.js --username=xxx --password=xxx --nickname=xxx [--email=xxx]',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findFirst({ where: { username } });
    if (existing) {
      console.error(`用户名 ${username} 已存在`);
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { username, passwordHash, displayName: nickname, email: email || null },
    });
    console.log(`已创建用户：${user.username}（${user.displayName}），id=${user.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
