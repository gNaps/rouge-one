import type { FastifyInstance } from 'fastify';
import type { PrismaClient, Prisma, Project } from '@prisma/client';
import { assert } from './security';

const id = { type: 'integer', minimum: 1 };
const name = { type: 'string', minLength: 1, maxLength: 100 };
const permissionIds = { type: 'array', items: id, uniqueItems: true, maxItems: 100 };
const body = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, minProperties: 1, additionalProperties: false });
const roleInclude = { permissions: { include: { permission: true } }, _count: { select: { People: true } } } as const;
const publicRole = (role: any) => ({ id: role.id, name: role.name, project_id: role.project_id, is_default: role.is_default, permissions: role.permissions.map((grant: any) => grant.permission).sort((a: any, b: any) => a.name.localeCompare(b.name)), user_count: role._count.People });
const cleanName = (value: string) => { const result = value.trim(); assert(result.length > 0, 400, 'Name cannot be empty'); return result; };

type Guards = { admin: (req: any) => Promise<void>; owned: (req: any, byCode?: boolean) => Promise<Project> };

export function registerAuthorizationRoutes(app: FastifyInstance, db: PrismaClient, guards: Guards) {
  // Serialize project authorization writes, including default-role switches and user assignment.
  const mutate = async <T>(req: any, change: (tx: Prisma.TransactionClient, project: Project) => Promise<T>) => {
    const project = await guards.owned(req, true);
    return db.$transaction(async tx => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Project" WHERE id = ${project.id} AND user_id = ${req.admin.id} FOR UPDATE`;
      assert(locked.length, 404, 'Project not found');
      return change(tx, project);
    });
  };
  const role = async (tx: Prisma.TransactionClient, project: Project, roleId: number) => {
    const result = await tx.role.findFirst({ where: { id: roleId, project_id: project.id }, include: roleInclude });
    assert(result, 404, 'Role not found'); return result;
  };
  const validatePermissions = async (tx: Prisma.TransactionClient, project: Project, ids: number[]) => {
    assert(await tx.permission.count({ where: { project_id: project.id, id: { in: ids } } }) === ids.length, 400, 'Every permission must belong to this project');
  };
  const revoke = (tx: Prisma.TransactionClient, project: Project, roleIds: number[]) => tx.people.updateMany({ where: { project_id: project.id, role_id: { in: roleIds } }, data: { auth_version: { increment: 1 } } });
  const pageSchema = { type: 'object', additionalProperties: false, properties: { page: { type: 'integer', minimum: 1, default: 1 }, take: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, name: { type: 'string', maxLength: 200 }, sortField: { type: 'string', enum: ['id', 'name'] }, sortOrder: { type: 'integer', enum: [1, -1], default: 1 } } };
  for (const resource of ['roles', 'permissions'] as const) {
    const prefix = `/api/${resource}/:tenant_code`;
    app.get(prefix, { preHandler: guards.admin, schema: { querystring: pageSchema } }, async (req: any) => {
      const p = await guards.owned(req, true);
      const where = { project_id: p.id, ...(req.query.name ? { name: { contains: req.query.name, mode: 'insensitive' as const } } : {}) };
      const options = { where, skip: (req.query.page - 1) * req.query.take, take: req.query.take, orderBy: { [req.query.sortField || 'id']: req.query.sortOrder === -1 ? 'desc' as const : 'asc' as const } };
      if (resource === 'roles') {
        const [roles, total] = await db.$transaction([db.role.findMany({ ...options, include: roleInclude }), db.role.count({ where })]);
        return { data: roles.map(publicRole), total };
      }
      const [data, total] = await db.$transaction([db.permission.findMany(options), db.permission.count({ where })]);
      return { data, total };
    });
    app.get(`${prefix}/:id`, { preHandler: guards.admin }, async (req: any) => {
      const p = await guards.owned(req, true);
      if (resource === 'roles') return publicRole(await role(db, p, req.params.id));
      const result = await db.permission.findFirst({ where: { project_id: p.id, id: req.params.id } });
      assert(result, 404, 'Permission not found'); return result;
    });
  }
  const roleProperties = { name, permission_ids: permissionIds, is_default: { type: 'boolean' } };
  app.post('/api/roles/:tenant_code', { preHandler: guards.admin, schema: { body: body(roleProperties, ['name']) } }, async (req: any, reply) => {
    const result = await mutate(req, async (tx, p) => {
      const ids = req.body.permission_ids || [];
      await validatePermissions(tx, p, ids);
      if (req.body.is_default) await tx.role.updateMany({ where: { project_id: p.id, is_default: true }, data: { is_default: false } });
      const created = await tx.role.create({ data: { name: cleanName(req.body.name), project_id: p.id, is_default: !!req.body.is_default } });
      if (ids.length) await tx.rolePermission.createMany({ data: ids.map((permission_id: number) => ({ role_id: created.id, permission_id, project_id: p.id })) });
      return publicRole(await role(tx, p, created.id));
    });
    return reply.code(201).send(result);
  });
  app.patch('/api/roles/:tenant_code/:id', { preHandler: guards.admin, schema: { body: body(roleProperties) } }, async (req: any) => mutate(req, async (tx, p) => {
    const current = await role(tx, p, req.params.id);
    assert(!(current.is_default && req.body.is_default === false), 409, 'Choose another default role instead');
    const ids: number[] | undefined = req.body.permission_ids;
    if (ids) await validatePermissions(tx, p, ids);
    const nextName = req.body.name === undefined ? current.name : cleanName(req.body.name);
    const previousIds = current.permissions.map(grant => grant.permission_id).sort((a, b) => a - b);
    const changed = nextName !== current.name || ids !== undefined && JSON.stringify([...ids].sort((a, b) => a - b)) !== JSON.stringify(previousIds);
    if (req.body.is_default && !current.is_default) await tx.role.updateMany({ where: { project_id: p.id, is_default: true }, data: { is_default: false } });
    if (ids) {
      await tx.rolePermission.deleteMany({ where: { project_id: p.id, role_id: current.id } });
      if (ids.length) await tx.rolePermission.createMany({ data: ids.map(permission_id => ({ project_id: p.id, role_id: current.id, permission_id })) });
    }
    await tx.role.update({ where: { id: current.id }, data: { name: nextName, ...(req.body.is_default === undefined ? {} : { is_default: req.body.is_default }) } });
    if (changed) await revoke(tx, p, [current.id]);
    return publicRole(await role(tx, p, current.id));
  }));
  app.delete('/api/roles/:tenant_code/:id', { preHandler: guards.admin }, async (req: any) => mutate(req, async (tx, p) => {
    const current = await role(tx, p, req.params.id);
    assert(!current.is_default, 409, 'Choose another default role before deleting this role');
    assert(current._count.People === 0, 409, 'Assign this role’s users to another role before deleting it');
    await tx.role.delete({ where: { id: current.id } }); return { message: 'Role deleted' };
  }));
  app.post('/api/permissions/:tenant_code', { preHandler: guards.admin, schema: { body: body({ name }, ['name']) } }, async (req: any, reply) => {
    const result = await mutate(req, (tx, p) => tx.permission.create({ data: { project_id: p.id, name: cleanName(req.body.name) } }));
    return reply.code(201).send(result);
  });
  app.patch('/api/permissions/:tenant_code/:id', { preHandler: guards.admin, schema: { body: body({ name }, ['name']) } }, async (req: any) => mutate(req, async (tx, p) => {
    const current = await tx.permission.findFirst({ where: { project_id: p.id, id: req.params.id }, include: { roles: true } });
    assert(current, 404, 'Permission not found');
    const nextName = cleanName(req.body.name);
    if (nextName !== current.name) await revoke(tx, p, current.roles.map(grant => grant.role_id));
    return tx.permission.update({ where: { id: current.id }, data: { name: nextName } });
  }));
  app.delete('/api/permissions/:tenant_code/:id', { preHandler: guards.admin }, async (req: any) => mutate(req, async (tx, p) => {
    const current = await tx.permission.findFirst({ where: { project_id: p.id, id: req.params.id }, include: { roles: true } });
    assert(current, 404, 'Permission not found');
    await revoke(tx, p, current.roles.map(grant => grant.role_id));
    await tx.permission.delete({ where: { id: current.id } }); return { message: 'Permission deleted' };
  }));
  app.patch('/api/people/:tenant_code/:id/role', { preHandler: guards.admin, schema: { body: body({ role_id: id }, ['role_id']) } }, async (req: any) => mutate(req, async (tx, p) => {
    const person = await tx.people.findFirst({ where: { id: req.params.id, project_id: p.id } });
    assert(person, 404, 'User not found');
    const assigned = await role(tx, p, req.body.role_id);
    if (person.role_id !== assigned.id) await tx.people.update({ where: { id: person.id }, data: { role_id: assigned.id, auth_version: { increment: 1 } } });
    return { id: person.id, role: { id: assigned.id, name: assigned.name } };
  }));
}
