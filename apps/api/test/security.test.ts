import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, digest, challenge, equal, signPeople, verifyPeople } from '../src/security';
import type { Config } from '../src/config';
const config = { publicUrl: 'http://localhost:4200', peopleKey: 'people'.repeat(10), adminKey: 'admin'.repeat(10) } as Config;
test('tokens are random; hashing and PKCE use distinct encodings', () => {
  assert.notEqual(randomToken(), randomToken()); assert.equal(digest('value').length, 64);
  assert.match(challenge('verifier'), /^[A-Za-z0-9_-]{43}$/);
  assert(equal('abc', 'abc')); assert(!equal('abc', 'abcd'));
});
test('project tokens include scoped role and permission claims without personal secrets', () => {
  const token = signPeople(config, { id: 1, project_id: 3, auth_version: 0, role_id: 2, role: { id: 2, name: 'Editor', project_id: 3, permissions: [{ project_id: 3, permission: { project_id: 3, name: 'articles:write' } }, { project_id: 3, permission: { project_id: 3, name: 'articles:read' } }] }, password: 'never include', email: 'private@example.invalid' }, 'tenant-a');
  const claims = verifyPeople(config, token, 'tenant-a');
  assert.equal(claims.kind, 'people'); assert.equal(claims.password, undefined); assert.equal(claims.email, undefined);
  assert.equal(claims.role, 2); assert.deepEqual(claims.roles, ['Editor']); assert.deepEqual(claims.permissions, ['articles:read', 'articles:write']);
  assert.throws(() => verifyPeople(config, token, 'tenant-b'));
  assert.throws(() => signPeople(config, { id: 1, project_id: 3, role_id: 2, role: { id: 2, project_id: 4, permissions: [] } }, 'tenant-a'));
  assert.throws(() => signPeople(config, { id: 1, project_id: 3, role_id: 2, role: { id: 2, project_id: 3, permissions: [{ project_id: 3, permission: { name: 'foreign', project_id: 4 } }] } }, 'tenant-a'));
  assert.throws(() => verifyPeople({ ...config, peopleKey: config.adminKey }, token, 'tenant-a'));
});
