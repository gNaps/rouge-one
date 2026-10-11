import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { mkdtemp, mkdir, cp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { preflight } from '../src/database/preflight';
const databaseUrl = process.env.TEST_DATABASE_URL;
test('populated historical schema upgrades without losing accounts or relationships', { skip: !databaseUrl }, async () => {
  const original = new URL(databaseUrl!); assert.match(original.pathname, /test/);
  const target = new URL(original); target.pathname = '/rouge_upgrade_test';
  const admin = new PrismaClient({ datasources: { db: { url: original.toString() } } });
  // This database is owned exclusively by this test. Refuse to overwrite an existing one.
  const exists = await admin.$queryRaw<Array<{ datname: string }>>`SELECT datname FROM pg_database WHERE datname = 'rouge_upgrade_test'`;
  assert.equal(exists.length, 0, 'Remove the disposable rouge_upgrade_test database before rerunning');
  await admin.$executeRawUnsafe('CREATE DATABASE rouge_upgrade_test');
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  const temp = await mkdtemp(path.join(tmpdir(), 'rouge-migrations-'));
  const migrationRoot = path.resolve(__dirname, '../prisma');
  const require = createRequire(path.resolve(__dirname, '../package.json'));
  const cli = require.resolve('prisma/build/index.js');
  const deploy = (schema: string) => execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], { env: { ...process.env, DATABASE_URL: target.toString() }, stdio: 'pipe' });
  try {
    await mkdir(path.join(temp, 'migrations'));
    await writeFile(path.join(temp, 'schema.prisma'), 'datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n');
    for (const name of await readdir(path.join(migrationRoot, 'migrations'))) if (name.startsWith('202404') || name === 'migration_lock.toml') await cp(path.join(migrationRoot, 'migrations', name), path.join(temp, 'migrations', name), { recursive: true });
    deploy(path.join(temp, 'schema.prisma'));
    await db.$executeRawUnsafe(`INSERT INTO "User" (id,email,password,firstname) VALUES (1,'Owner@Example.invalid','preserved-hash','Owner')`);
    await db.$executeRawUnsafe(`INSERT INTO "Project" (id,tenant_code,user_id,name,redirect_url) VALUES (1,'old-tenant',1,'Existing project','http://localhost:4200/example/')`);
    await db.$executeRawUnsafe(`INSERT INTO "Role" (id,name,project_id,is_default) VALUES (1,'User',1,true)`);
    await db.$executeRawUnsafe(`INSERT INTO "People" (id,email,password,project_id,role_id) VALUES (1,'Person@Example.invalid','person-hash',1,1)`);
    await db.$executeRawUnsafe(`INSERT INTO "Permission" (id,name,project_id,role_id) VALUES (1,'articles:read',1,1)`);
    assert.deepEqual((await preflight(db)).issues, []);
    await db.$executeRawUnsafe(`INSERT INTO "Role" (id,name,project_id) VALUES (2,'User',1)`);
    assert((await preflight(db)).issues.some(issue => issue.includes('Duplicate project role name')));
    await db.$executeRawUnsafe(`DELETE FROM "Role" WHERE id=2`);
    // Detect normalized identity conflicts without changing data.
    await db.$executeRawUnsafe(`INSERT INTO "User" (id,email) VALUES (2,'owner@example.invalid')`);
    assert((await preflight(db)).issues.some(s => s.includes('Duplicate normalized administrator')));
    await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id=2`);
    // Detect schema drift before migration.
    await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN accidental TEXT');
    assert((await preflight(db)).issues.some(s => s.includes('Unexpected column')));
    await db.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN accidental');
    await cp(path.join(migrationRoot, 'migrations', '20261009120000_secure_installation'), path.join(temp, 'migrations', '20261009120000_secure_installation'), { recursive: true });
    deploy(path.join(temp, 'schema.prisma'));
    assert.deepEqual((await preflight(db)).issues, []); // Already-on-v0.1 upgrades are supported too.
    deploy(path.join(migrationRoot, 'schema.prisma'));
    assert.equal(await db.rolePermission.count({ where: { role_id: 1, permission_id: 1, project_id: 1 } }), 1);
    assert.equal((await db.permission.findUniqueOrThrow({ where: { id: 1 } })).name, 'articles:read');
    const user = await db.user.findUnique({ where: { id: 1 } }); const person = await db.people.findUnique({ where: { id: 1 } });
    assert.equal(user?.email, 'owner@example.invalid'); assert.equal(user?.password, 'preserved-hash'); assert.equal(user?.firstname, 'Owner');
    assert.equal(person?.password, 'person-hash'); assert.equal(person?.project_id, 1); assert.equal(person?.role_id, 1);
    assert(await db.installation.findUnique({ where: { id: 1 } }));
    assert.deepEqual((await preflight(db)).issues, []);
    deploy(path.join(migrationRoot, 'schema.prisma')); // Applying twice must be harmless.
    assert.equal(await db.user.count(), 1); assert.equal(await db.people.count(), 1);
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe('DROP DATABASE rouge_upgrade_test');
    await admin.$disconnect(); await rm(temp, { recursive: true, force: true });
  }
});
