import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadConfig } from '../config';

export async function preflight(db: PrismaClient) {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length === 0) return { fresh: true, issues: [] as string[] };
  const issues: string[] = [];
  if (!tables.some(t => t.tablename === '_prisma_migrations')) return { fresh: false, issues: ['Database contains tables without Prisma migration history. Use a dedicated empty database or reconcile the existing schema first.'] };
  const applied = await db.$queryRaw<Array<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>>`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  const folder = path.resolve(__dirname, '../../prisma/migrations');
  const names = readdirSync(folder).filter(n => /^\d/.test(n)).sort();
  for (const migration of applied) {
    if (migration.rolled_back_at) continue;
    if (!migration.finished_at) issues.push(`Unfinished migration: ${migration.migration_name}`);
    if (!names.includes(migration.migration_name)) { issues.push(`Unknown migration: ${migration.migration_name}`); continue; }
    const checksum = createHash('sha256').update(readFileSync(path.join(folder, migration.migration_name, 'migration.sql'))).digest('hex');
    if (checksum !== migration.checksum) issues.push(`Migration checksum mismatch: ${migration.migration_name}`);
  }
  const completed = new Set(applied.filter(m => m.finished_at && !m.rolled_back_at).map(m => m.migration_name));
  if (names.filter(n => n.startsWith('202404')).some(n => !completed.has(n))) issues.push('Historical migrations are incomplete. Reconcile on a copy before upgrading; destructive historical migrations will not run automatically.');
  if (issues.length) return { fresh: false, issues };
  const schema = readFileSync(path.resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const upgraded = completed.has('20261009120000_secure_installation');
  const authorization = completed.has('20261010190000_project_authorization');
  const expected: Record<string, Record<string, { type: string; nullable: boolean }>> = {};
  const scalarTypes: Record<string, string> = { Int: 'integer', String: 'text', Boolean: 'boolean', DateTime: 'timestamp without time zone', Json: 'jsonb' };
  for (const model of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    if (!upgraded && ['Installation', 'SecurityToken'].includes(model[1]) || !authorization && model[1] === 'RolePermission') continue;
    expected[model[1]] = {};
    for (const line of model[2].split('\n')) {
      const field = line.trim().match(/^(\w+)\s+(Int|String|Boolean|DateTime|Json)(\?)?(?:\s|$)/);
      if (!field || !upgraded && field[1] === 'auth_version') continue;
      expected[model[1]][field[1]] = { type: scalarTypes[field[2]], nullable: !!field[3] };
    }
  }
  if (!authorization) expected.Permission.role_id = { type: 'integer', nullable: true };
  const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>>`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public'`;
  for (const [table, fields] of Object.entries(expected)) {
    for (const [name, field] of Object.entries(fields)) {
      const actual = columns.find(c => c.table_name === table && c.column_name === name);
      if (!actual) issues.push(`Missing column: ${table}.${name}`);
      else if (actual.data_type !== field.type || (actual.is_nullable === 'YES') !== field.nullable) issues.push(`Column definition mismatch: ${table}.${name}`);
    }
    for (const column of columns.filter(c => c.table_name === table)) if (!fields[column.column_name]) issues.push(`Unexpected column: ${table}.${column.column_name}`);
  }
  for (const table of tables) if (table.tablename !== '_prisma_migrations' && !expected[table.tablename]) issues.push(`Unexpected table: ${table.tablename}`);
  if (issues.length) return { fresh: false, issues };
  const checks: Array<[string, Promise<Array<any>>]> = [
    ['Duplicate normalized administrator email', db.$queryRaw`SELECT lower(trim(email)) AS email FROM "User" GROUP BY lower(trim(email)) HAVING count(*) > 1`],
    ['Duplicate normalized project email', db.$queryRaw`SELECT project_id, lower(trim(email)) AS email FROM "People" GROUP BY project_id, lower(trim(email)) HAVING count(*) > 1`],
    ['Duplicate tenant code', db.$queryRaw`SELECT tenant_code FROM "Project" GROUP BY tenant_code HAVING count(*) > 1`],
    ['Multiple default roles', db.$queryRaw`SELECT project_id FROM "Role" WHERE is_default GROUP BY project_id HAVING count(*) > 1`],
    ['Cross-project role assignment', db.$queryRaw`SELECT p.id FROM "People" p JOIN "Role" r ON p.role_id = r.id WHERE p.project_id <> r.project_id`],
    ...(!authorization ? [['Cross-project permission assignment', db.$queryRaw`SELECT p.id FROM "Permission" p JOIN "Role" r ON p.role_id = r.id WHERE p.project_id <> r.project_id`] as [string, Promise<Array<any>>]] : []),
    ['Duplicate project role name', db.$queryRaw`SELECT project_id, name FROM "Role" GROUP BY project_id, name HAVING count(*) > 1`],
    ['Duplicate project permission name', db.$queryRaw`SELECT project_id, name FROM "Permission" GROUP BY project_id, name HAVING count(*) > 1`],
  ];
  for (const [label, query] of checks) { const rows = await query; if (rows.length) issues.push(`${label}: ${rows.length} conflicting group(s). Resolve explicitly; no records were changed.`); }
  return { fresh: false, issues };
}
if (require.main === module) {
  const config = loadConfig();
  const db = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  preflight(db).then(result => { console.log(JSON.stringify(result, null, 2)); if (result.issues.length) process.exitCode = 1; }).catch(() => { console.error('Cannot inspect the database. Check DATABASE_URL and connectivity.'); process.exitCode = 1; }).finally(() => db.$disconnect());
}
