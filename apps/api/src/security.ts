import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { Config } from './config';
import type { AuthorizedUser } from '@rouge-one/contracts';

export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const challenge = (value: string) => crypto.createHash('sha256').update(value).digest('base64url');
export const equal = (a: string, b: string) => crypto.timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const publicPerson = (person: any) => ({ id: person.id, email: person.email, firstname: person.firstname, surname: person.surname, image: person.image, verified: person.verified });

export class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export function assert(value: unknown, status: number, message: string): asserts value { if (!value) throw new HttpError(status, message); }

export async function issueToken(db: PrismaClient | Prisma.TransactionClient, purpose: string, subjectType: string, subjectId: number | null, tenantId: number | null, data: Prisma.InputJsonValue, seconds = 900) {
  const token = randomToken();
  await db.securityToken.create({ data: { hash: digest(token), purpose, subjectType, subjectId, tenantId, data, expiresAt: new Date(Date.now() + seconds * 1000) } });
  return token;
}

export async function consumeToken<T>(db: PrismaClient, token: string, purpose: string, validate: (record: any) => void, use: (tx: Prisma.TransactionClient, record: any) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const record = await tx.securityToken.findUnique({ where: { hash: digest(token) } });
    assert(record && record.purpose === purpose && record.expiresAt > new Date(), 400, 'Invalid or expired token');
    validate(record);
    const deleted = await tx.securityToken.deleteMany({ where: { hash: record.hash, purpose, expiresAt: { gt: new Date() } } });
    assert(deleted.count === 1, 400, 'Token already used');
    return use(tx, record);
  });
}

export const personAuthorization = { role: { include: { permissions: { include: { permission: true } } } } } as const;

export function authorizedPerson(person: any): AuthorizedUser {
  const role = person.role;
  assert(role && role.id === person.role_id && role.project_id === person.project_id, 401, 'Invalid role assignment');
  assert(role.permissions.every((grant: any) => grant.project_id === person.project_id && grant.permission.project_id === person.project_id), 401, 'Invalid permission assignment');
  return { ...publicPerson(person), role: { id: role.id, name: role.name }, permissions: [...new Set<string>(role.permissions.map((grant: any) => grant.permission.name))].sort() };
}

export function signPeople(config: Config, person: any, tenantCode: string) {
  const authorization = authorizedPerson(person);
  return jwt.sign({ kind: 'people', tenant: tenantCode, version: person.auth_version, role: person.role_id, roles: [authorization.role.name], permissions: authorization.permissions }, config.peopleKey, { subject: String(person.id), issuer: config.publicUrl, audience: tenantCode, expiresIn: '1h', algorithm: 'HS256' });
}
export function verifyPeople(config: Config, token: string, tenantCode: string) {
  const claims = jwt.verify(token, config.peopleKey, { issuer: config.publicUrl, audience: tenantCode, algorithms: ['HS256'] }) as jwt.JwtPayload;
  assert(claims.kind === 'people' && claims.tenant === tenantCode && typeof claims.sub === 'string' && /^[1-9][0-9]*$/.test(claims.sub) && Number.isSafeInteger(Number(claims.sub)) && Number.isSafeInteger(claims.version) && claims.version >= 0 && Number.isSafeInteger(claims.role) && claims.role > 0 && Array.isArray(claims.roles) && claims.roles.length === 1 && claims.roles.every((value: unknown) => typeof value === 'string' && value.length > 0) && Array.isArray(claims.permissions) && claims.permissions.every((value: unknown) => typeof value === 'string' && value.length > 0), 401, 'Invalid identity');
  return claims;
}
