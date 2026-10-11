import { createRequire } from 'node:module';
import path from 'node:path';
export default async function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  if (!new URL(databaseUrl).pathname.includes('test')) throw new Error('Refusing to reset non-test database');
  const require = createRequire(path.resolve('apps/api/package.json'));
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try { await db.$executeRawUnsafe('TRUNCATE "SecurityToken", "Installation", "MagicToken", "Permission", "People", "Role", "Project", "User" RESTART IDENTITY CASCADE'); }
  finally { await db.$disconnect(); }
}
