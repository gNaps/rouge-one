import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Config } from './config';
import type { LoginConfig } from '@rouge-one/contracts';
import { createMailer, Mailer } from './mail';
import { registerAuthorizationRoutes } from './authorization';
import { assert, HttpError, randomToken, digest, equal, normalizeEmail, publicPerson, issueToken, consumeToken, challenge, signPeople, verifyPeople, authorizedPerson, personAuthorization } from './security';

const emailSchema = { type: 'string', format: 'email', maxLength: 254 };
const passwordSchema = { type: 'string', minLength: 12, maxLength: 72 };
const text = (maxLength = 200) => ({ type: 'string', minLength: 1, maxLength });
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const credentialSchema = object({ email: emailSchema, password: { ...passwordSchema, minLength: 1 } }, ['email', 'password']);
const pkceSchema = { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' };
const sessionCookie = 'rouge_session';
const csrfCookie = 'rouge_csrf';
const oauthCookie = 'rouge_oauth';
const generic = { message: 'If the account is eligible, an email has been sent.' };
const safeProject = (p: any, config: Config) => {
  const { google_secret_id, facebook_secret_id, twitch_secret_id, github_secret_id, ...safe } = p;
  return { ...safe, google_configured: !!p.google_client_id && !!google_secret_id, login_url: `${config.publicUrl}/login/${p.tenant_code}`, google_callback_url: `${config.publicUrl}/api/auth/${p.tenant_code}/sign-in/google/callback` };
};

export interface GoogleProfile { sub: string; email: string; email_verified: boolean; given_name?: string; family_name?: string; picture?: string }
export type GoogleExchange = (code: string, redirectUri: string, verifier: string, clientId: string, secret: string) => Promise<GoogleProfile>;
const exchangeGoogle: GoogleExchange = async (code, redirectUri, verifier, clientId, secret) => {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code, redirect_uri: redirectUri, code_verifier: verifier, client_id: clientId, client_secret: secret, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(10000) });
  assert(response.ok, 400, 'Google authorization failed');
  const data = await response.json() as { access_token: string };
  const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${data.access_token}` }, signal: AbortSignal.timeout(10000) });
  assert(profile.ok, 400, 'Google identity verification failed');
  return await profile.json() as GoogleProfile;
};

export async function buildServer(config: Config, options: { db?: PrismaClient; mailer?: Mailer; googleExchange?: GoogleExchange; logger?: boolean; disableRateLimit?: boolean } = {}): Promise<FastifyInstance> {
  const db = options.db || new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const mailer = options.mailer || createMailer(config);
  const googleExchange = options.googleExchange || exchangeGoogle;
  const app = Fastify({ http: { maxHeaderSize: 64 * 1024 }, logger: options.logger === false ? false : { serializers: { req: (req: any) => ({ method: req.method, url: req.url?.split('?')[0], remoteAddress: req.ip }) } }, trustProxy: config.trustProxy, bodyLimit: 64 * 1024, ajv: { customOptions: { removeAdditional: false } } });
  await app.register(cookie);
  await app.register(rateLimit, { max: options.disableRateLimit ? 100000 : 120, timeWindow: '1 minute' });
  await app.register(cors, {
    delegator: async (req: FastifyRequest) => {
      const origin = req.headers.origin;
      if (origin === config.publicUrl) return { origin, credentials: true };
      let allowed = false;
      const match = req.url.match(/^\/api\/auth\/([^/?]+)\/(token|me|config)(?:[/?]|$)/);
      if (origin && match) {
        let code: string;
        try { code = decodeURIComponent(match[1]); } catch { return { origin: false }; }
        const project = await db.project.findUnique({ where: { tenant_code: code }, select: { redirect_url: true } });
        try { allowed = !!project?.redirect_url && new URL(project.redirect_url).origin === origin; } catch {}
      }
      return { origin: allowed ? origin : false, credentials: false };
    },
  });
  app.addHook('onClose', async () => { if (!options.db) await db.$disconnect(); });
  app.addHook('onRoute', route => {
    const names = [...route.url.matchAll(/:(\w+)/g)].map(match => match[1]);
    if (names.length) route.schema = { ...route.schema, params: object(Object.fromEntries(names.map(name => [name, name === 'id' ? { type: 'integer', minimum: 1 } : { type: 'string', minLength: 1, maxLength: 100 }])), names) };
  });
  app.setErrorHandler((error: any, req, reply) => {
    if (error.validation) return reply.code(400).send({ message: 'Invalid request', details: error.validation.map((e: any) => ({ path: e.instancePath, message: e.message })) });
    if (error.code === 'P2002') return reply.code(409).send({ message: 'A matching record already exists' });
    if (error.code === 'P2003') return reply.code(409).send({ message: 'Record has dependent data or an invalid relationship' });
    if (error instanceof HttpError || error.statusCode && error.statusCode < 500) return reply.code(error.statusCode).send({ message: error.message });
    req.log.error({ code: error.code || 'INTERNAL_ERROR' }, 'Request failed');
    return reply.code(500).send({ message: 'Request failed. Check the server configuration.' });
  });
  const hashPassword = async (value: string) => {
    assert(Buffer.byteLength(value, 'utf8') <= 72, 400, 'Password must be at most 72 UTF-8 bytes');
    return bcrypt.hash(value, 12);
  };
  const cookies = { path: '/api', httpOnly: true, secure: config.production, sameSite: 'lax' as const };
  const currentAdmin = async (req: any) => {
    try {
      const raw = req.cookies[sessionCookie];
      const claims = jwt.verify(raw || '', config.adminKey, { algorithms: ['HS256'], audience: 'rouge-admin', issuer: config.publicUrl }) as jwt.JwtPayload;
      assert(claims.kind === 'admin' && claims.sub && claims.jti, 401, 'Authentication required');
      const record = await db.securityToken.findUnique({ where: { hash: digest(claims.jti) } });
      assert(record?.purpose === 'session' && record.subjectType === 'admin' && record.subjectId === Number(claims.sub) && record.expiresAt > new Date(), 401, 'Session expired');
      const user = await db.user.findUnique({ where: { id: Number(claims.sub) } });
      assert(user && user.auth_version === claims.version, 401, 'Session expired');
      req.admin = user;
      req.adminSession = record;
      return user;
    } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(401, 'Authentication required'); }
  };
  const admin = async (req: any) => {
    assert(!req.headers.origin || req.headers.origin === config.publicUrl, 403, 'Invalid request origin');
    await currentAdmin(req);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      assert(req.headers.origin === config.publicUrl, 403, 'Invalid request origin');
      const provided = req.headers['x-csrf-token'];
      assert(typeof provided === 'string' && equal(provided, req.adminSession.data.csrf), 403, 'Invalid CSRF token');
    }
  };
  const startSession = async (reply: any, user: any) => {
    const csrf = randomToken();
    const jti = await issueToken(db, 'session', 'admin', user.id, null, { csrf }, 86400);
    const token = jwt.sign({ kind: 'admin', version: user.auth_version }, config.adminKey, { subject: String(user.id), audience: 'rouge-admin', issuer: config.publicUrl, jwtid: jti, expiresIn: '1d', algorithm: 'HS256' });
    reply.setCookie(sessionCookie, token, { ...cookies, maxAge: 86400 });
    reply.setCookie(csrfCookie, csrf, { ...cookies, httpOnly: false, path: '/', maxAge: 86400 });
    await db.user.update({ where: { id: user.id }, data: { last_login: new Date(), count_login: { increment: 1 } } });
    return { user: publicPerson(user), csrfToken: csrf };
  };
  const sameOrigin = (req: any) => assert(req.headers.origin === config.publicUrl, 403, 'Invalid request origin');
  const tenant = async (code: string) => {
    const p = await db.project.findUnique({ where: { tenant_code: code } });
    assert(p, 404, 'Project not found'); return p;
  };
  const owned = async (req: any, byCode = false) => {
    const p = byCode ? await tenant(req.params.tenant_code) : await db.project.findUnique({ where: { id: Number(req.params.id) } });
    assert(p && p.user_id === req.admin.id, 404, 'Project not found'); return p;
  };
  const integration = (p: any, input: any) => {
    assert(p.redirect_url && input.redirect_uri === p.redirect_url, 400, 'Callback URL must match the registered URL');
    assert(typeof input.code_challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(input.code_challenge), 400, 'PKCE S256 challenge is required');
    assert(typeof input.state === 'string' && input.state.length >= 16 && input.state.length <= 200, 400, 'Integration state is required');
    return { redirect_uri: input.redirect_uri, code_challenge: input.code_challenge, state: input.state };
  };
  const personCode = async (p: any, user: any, flow: any) => {
    const code = await issueToken(db, 'code', 'people', user.id, p.id, { ...flow, version: user.auth_version }, 60);
    const callback = new URL(flow.redirect_uri);
    callback.searchParams.set('code', code); callback.searchParams.set('state', flow.state);
    await db.people.update({ where: { id: user.id }, data: { last_login: new Date(), count_login: { increment: 1 } } });
    return { redirect: callback.toString() };
  };
  const emailAction = async (purpose: string, kind: string, user: any, project: any, data: any, path: string) => {
    const token = await issueToken(db, purpose, kind, user.id, project?.id || null, { ...data, version: user.auth_version });
    const url = new URL(path, config.publicUrl); url.searchParams.set('token', token);
    try { await mailer.send(user.email, purpose === 'magic' ? 'Sign in to Rouge One' : purpose === 'verify' ? 'Verify your email' : 'Reset your password', url.toString()); }
    catch { await db.securityToken.deleteMany({ where: { hash: digest(token) } }); app.log.warn({ purpose }, 'Email delivery failed; token revoked'); }
  };

  app.get('/api/health', async (_req, reply) => { try { await db.$queryRaw`SELECT 1`; return { status: 'ok' }; } catch { return reply.code(503).send({ status: 'unavailable' }); } });
  app.get('/api/setup/status', async () => ({ complete: !!(await db.installation.findUnique({ where: { id: 1 } })) || (await db.user.count()) > 0 }));
  app.post('/api/setup', { schema: { body: object({ email: emailSchema, password: passwordSchema, token: text(200) }, ['email', 'password', 'token']) }, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req: any, reply) => {
    sameOrigin(req); assert(equal(req.body.token, config.bootstrapToken), 403, 'Invalid setup token');
    const password = await hashPassword(req.body.password);
    let user;
    try {
      user = await db.$transaction(async tx => {
        assert(await tx.user.count() === 0, 409, 'Setup already completed');
        await tx.installation.create({ data: { id: 1 } });
        return tx.user.create({ data: { email: normalizeEmail(req.body.email), password } });
      });
    } catch (error: any) { if (error.code === 'P2002') throw new HttpError(409, 'Setup already completed'); throw error; }
    if (config.smtpHost) await emailAction('verify', 'admin', user, null, {}, '/auth/email/verify');
    return startSession(reply, user);
  });
  app.get('/api/auth/methods', async () => ({ password: true, google: !!config.googleClientId, magic_link: !!config.smtpHost, email: !!config.smtpHost }));
  app.get('/api/auth/me', { preHandler: admin }, async (req: any) => ({ user: publicPerson(req.admin), csrfToken: req.adminSession.data.csrf }));
  app.post('/api/auth/sign-in', { schema: { body: credentialSchema }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req: any, reply) => {
    sameOrigin(req);
    const user = await db.user.findUnique({ where: { email: normalizeEmail(req.body.email) } });
    const dummy = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid = await bcrypt.compare(req.body.password, user?.password || dummy);
    assert(user && user.password && valid, 401, 'Invalid credentials'); return startSession(reply, user);
  });
  app.post('/api/auth/sign-out', { preHandler: admin }, async (req: any, reply) => {
    await db.securityToken.deleteMany({ where: { hash: req.adminSession.hash } });
    reply.clearCookie(sessionCookie, cookies); reply.clearCookie(csrfCookie, { ...cookies, httpOnly: false, path: '/' });
    return { message: 'Signed out' };
  });
  app.post('/api/auth/sign-up', async () => { throw new HttpError(403, 'Use the first-run setup to create the administrator'); });
  app.get('/api/auth/:tenant_code/config', async (req: any) => {
    const p = await tenant(req.params.tenant_code);
    return { name: p.name, tenant_code: p.tenant_code, redirect_uri: p.redirect_url || '', methods: { password: p.is_password_active, google: p.is_google_active && !!p.google_client_id && !!p.google_secret_id, magic_link: p.is_magic_link_active && !!config.smtpHost }, email: !!config.smtpHost } satisfies LoginConfig;
  });
  const flowProperties = { redirect_uri: text(2048), code_challenge: pkceSchema, state: { type: 'string', minLength: 16, maxLength: 200 } };
  const flowRequired = ['redirect_uri', 'code_challenge', 'state'];
  app.post('/api/auth/:tenant_code/sign-up', { schema: { body: object({ email: emailSchema, password: passwordSchema, ...flowProperties }, ['email', 'password', ...flowRequired]) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req: any) => {
    const p = await tenant(req.params.tenant_code); assert(p.is_password_active, 403, 'Password sign-in is disabled');
    const flow = integration(p, req.body);
    const role = await db.role.findFirst({ where: { project_id: p.id, is_default: true } }); assert(role, 409, 'Default role is missing');
    const user = await db.people.create({ data: { email: normalizeEmail(req.body.email), password: await hashPassword(req.body.password), project_id: p.id, role_id: role.id } });
    if (config.smtpHost) await emailAction('verify', 'people', user, p, {}, `/login/${p.tenant_code}/verify`);
    return personCode(p, user, flow);
  });
  app.post('/api/auth/:tenant_code/sign-in', { schema: { body: object({ email: emailSchema, password: { ...passwordSchema, minLength: 1 }, ...flowProperties }, ['email', 'password', ...flowRequired]) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req: any) => {
    const p = await tenant(req.params.tenant_code); assert(p.is_password_active, 403, 'Password sign-in is disabled');
    const flow = integration(p, req.body);
    const user = await db.people.findUnique({ where: { project_id_email: { project_id: p.id, email: normalizeEmail(req.body.email) } } });
    const valid = await bcrypt.compare(req.body.password, user?.password || '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
    assert(user && user.password && valid, 401, 'Invalid credentials'); return personCode(p, user, flow);
  });
  app.post('/api/auth/:tenant_code/token', { schema: { body: object({ code: text(200), code_verifier: { type: 'string', pattern: '^[A-Za-z0-9._~-]{43,128}$' }, redirect_uri: text(2048) }, ['code', 'code_verifier', 'redirect_uri']) } }, async (req: any) => {
    const p = await tenant(req.params.tenant_code);
    return consumeToken(db, req.body.code, 'code', record => {
      assert(record.subjectType === 'people' && record.tenantId === p.id && record.data.redirect_uri === req.body.redirect_uri && p.redirect_url === req.body.redirect_uri && equal(record.data.code_challenge, challenge(req.body.code_verifier)), 400, 'Invalid authorization code');
    }, async (tx, record) => {
      const user = await tx.people.findUnique({ where: { id: record.subjectId! }, include: personAuthorization });
      assert(user && user.project_id === p.id && user.auth_version === record.data.version, 400, 'Authorization expired');
      return { access_token: signPeople(config, user, p.tenant_code), token_type: 'Bearer', expires_in: 3600, user: authorizedPerson(user) };
    });
  });
  app.get('/api/auth/:tenant_code/me', async (req: any) => {
    const p = await tenant(req.params.tenant_code);
    let claims; try { claims = verifyPeople(config, req.headers.authorization?.replace(/^Bearer /, '') || '', p.tenant_code); } catch { throw new HttpError(401, 'Invalid access token'); }
    const user = await db.people.findUnique({ where: { id: Number(claims.sub) }, include: personAuthorization });
    assert(user && user.project_id === p.id && user.auth_version === claims.version, 401, 'Session expired');
    return { user: authorizedPerson(user) };
  });
  for (const kind of ['admin', 'people']) {
    const prefix = kind === 'admin' ? '/api/auth' : '/api/auth/:tenant_code';
    for (const purpose of ['magic', 'reset', 'verify']) {
      const endpoint = purpose === 'magic' ? 'sign-in/magic-link' : `email/${purpose}`;
      app.post(`${prefix}/${endpoint}`, { schema: { body: object({ email: emailSchema, ...(kind === 'people' && purpose === 'magic' ? flowProperties : {}) }, ['email', ...(kind === 'people' && purpose === 'magic' ? flowRequired : [])]) }, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req: any) => {
        if (kind === 'admin') sameOrigin(req);
        assert(config.smtpHost, 503, 'Email delivery is not configured');
        const p = kind === 'people' ? await tenant(req.params.tenant_code) : null;
        if (purpose === 'magic' && p) assert(p.is_magic_link_active, 403, 'Magic link sign-in is disabled');
        const flow = purpose === 'magic' && p ? integration(p, req.body) : {};
        const email = normalizeEmail(req.body.email);
        let user: any = p ? await db.people.findUnique({ where: { project_id_email: { project_id: p.id, email } } }) : await db.user.findUnique({ where: { email } });
        if (!user && p && purpose === 'magic') {
          const role = await db.role.findFirst({ where: { project_id: p.id, is_default: true } });
          assert(role, 409, 'Default role is missing');
          user = await db.people.upsert({ where: { project_id_email: { project_id: p.id, email } }, update: {}, create: { email, project_id: p.id, role_id: role.id } });
        }
        if (user && !(purpose === 'verify' && user.verified)) {
          const base = p ? `/login/${p.tenant_code}` : '/auth/email';
          await emailAction(purpose, kind, user, p, flow, `${base}/${purpose}`);
        }
        return generic;
      });
      app.post(`${prefix}/email/${purpose}/consume`, { schema: { body: object({ token: text(200), ...(purpose === 'reset' ? { password: passwordSchema } : {}) }, ['token', ...(purpose === 'reset' ? ['password'] : [])]) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req: any, reply) => {
        if (kind === 'admin') sameOrigin(req);
        const p = kind === 'people' ? await tenant(req.params.tenant_code) : null;
        if (purpose === 'magic' && p) assert(p.is_magic_link_active && config.smtpHost, 403, 'Magic link sign-in is disabled');
        const password = purpose === 'reset' ? await hashPassword(req.body.password) : undefined;
        const result = await consumeToken(db, req.body.token, purpose, record => {
          assert(record.subjectType === kind && record.tenantId === (p?.id || null), 400, 'Invalid token destination');
          if (purpose === 'magic' && p) integration(p, record.data);
        }, async (tx, record) => {
          const user = kind === 'admin' ? await tx.user.findUnique({ where: { id: record.subjectId! } }) : await tx.people.findUnique({ where: { id: record.subjectId! } });
          assert(user && user.auth_version === record.data.version, 400, 'Token is no longer valid');
          const update = purpose === 'reset' ? { password, verified: true, auth_version: { increment: 1 } } : { verified: true };
          const updated = kind === 'admin' ? await tx.user.update({ where: { id: user.id }, data: update }) : await tx.people.update({ where: { id: user.id }, data: update });
          if (purpose === 'reset') await tx.securityToken.deleteMany({ where: { subjectType: kind, subjectId: user.id } });
          return { user: updated, flow: record.data };
        });
        if (purpose === 'magic') return p ? personCode(p, result.user, result.flow) : startSession(reply, result.user);
        return { message: purpose === 'reset' ? 'Password updated. Please sign in again.' : 'Email verified.' };
      });
    }
  }

  for (const kind of ['admin', 'people']) {
    const prefix = kind === 'admin' ? '/api/auth/sign-in/google' : '/api/auth/:tenant_code/sign-in/google';
    app.get(prefix, { schema: { querystring: object(kind === 'people' ? flowProperties : {}, kind === 'people' ? flowRequired : []) } }, async (req: any, reply) => {
      assert(await db.user.count() > 0, 403, 'Complete administrator setup first');
      const p = kind === 'people' ? await tenant(req.params.tenant_code) : null;
      const clientId = p ? p.google_client_id : config.googleClientId;
      const secret = p ? p.google_secret_id : config.googleClientSecret;
      assert(clientId && secret && (!p || p.is_google_active), 403, 'Google sign-in is disabled');
      const flow = p ? integration(p, req.query) : {};
      const verifier = randomToken();
      const redirectUri = `${config.publicUrl}${p ? `/api/auth/${p.tenant_code}/sign-in/google/callback` : '/api/auth/sign-in/google/callback'}`;
      const state = await issueToken(db, 'oauth', kind, null, p?.id || null, { ...flow, verifier, redirectUri }, 300);
      reply.setCookie(oauthCookie, state, { ...cookies, maxAge: 300 });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge(verifier), code_challenge_method: 'S256' }).toString();
      return reply.redirect(url.toString(), 302);
    });
    app.get(`${prefix}/callback`, { schema: { querystring: object({ code: text(4096), state: text(200), error: text(200), scope: text(4096), authuser: text(), prompt: text() }, ['state']) } }, async (req: any, reply) => {
      assert(req.cookies[oauthCookie] && equal(req.cookies[oauthCookie], req.query.state), 400, 'Invalid OAuth state');
      assert(!req.query.error && req.query.code, 400, 'Google authorization was not completed');
      reply.clearCookie(oauthCookie, cookies);
      const p = kind === 'people' ? await tenant(req.params.tenant_code) : null;
      const clientId = p ? p.google_client_id : config.googleClientId;
      const secret = p ? p.google_secret_id : config.googleClientSecret;
      assert(clientId && secret && (!p || p.is_google_active), 403, 'Google sign-in is disabled');
      // Consume state before making an external request. An unsuccessful attempt must restart authorization.
      const flow = await consumeToken(db, req.query.state, 'oauth', record => {
        assert(record.subjectType === kind && record.tenantId === (p?.id || null), 400, 'Invalid OAuth destination');
        if (p) integration(p, record.data);
      }, async (_tx, record) => record.data);
      const profile = await googleExchange(req.query.code, flow.redirectUri, flow.verifier, clientId, secret);
      assert(profile.sub && profile.email_verified === true && typeof profile.email === 'string', 400, 'Google email is not verified');
      const email = normalizeEmail(profile.email);
      let user: any;
      if (p) {
        const role = await db.role.findFirst({ where: { project_id: p.id, is_default: true } }); assert(role, 409, 'Default role is missing');
        user = await db.people.upsert({ where: { project_id_email: { project_id: p.id, email } }, update: { verified: true }, create: { email, firstname: profile.given_name, surname: profile.family_name, image: profile.picture, verified: true, provider: 'google', is_provider: true, project_id: p.id, role_id: role.id } });
      } else {
        user = await db.user.findUnique({ where: { email } }); assert(user, 403, 'No administrator account is registered for this email');
        user = await db.user.update({ where: { id: user.id }, data: { verified: true } });
      }
      if (p) return reply.redirect((await personCode(p, user, flow)).redirect);
      await startSession(reply, user); return reply.redirect(`${config.publicUrl}/`);
    });
  }

  const projectProperties = { name: text(120), description: { type: 'string', maxLength: 2000 }, redirect_url: text(2048), google_client_id: { type: 'string', maxLength: 500 }, google_secret_id: { type: 'string', maxLength: 500 }, is_google_active: { type: 'boolean' }, is_password_active: { type: 'boolean' }, is_magic_link_active: { type: 'boolean' } };
  const validateProject = (input: any, old?: any) => {
    const merged = { ...old, ...input, ...(old && input.google_secret_id === '' ? { google_secret_id: old.google_secret_id } : {}) };
    let redirect: URL; try { redirect = new URL(merged.redirect_url); } catch { throw new HttpError(400, 'A valid callback URL is required'); }
    assert(!redirect.username && !redirect.password && !redirect.hash && (redirect.protocol === 'https:' || redirect.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname)), 400, 'Use HTTPS for callbacks, or HTTP on localhost');
    assert(merged.is_password_active || merged.is_google_active || merged.is_magic_link_active, 400, 'Enable at least one sign-in method');
    assert(!merged.is_google_active || merged.google_client_id && merged.google_secret_id, 400, 'Configure Google client ID and secret');
    assert(!merged.is_magic_link_active || config.smtpHost, 400, 'Configure SMTP before enabling magic links');
    const data = { ...input };
    // An empty secret from an edit form means retain the existing credential.
    if (old && input.google_secret_id === '') delete data.google_secret_id;
    return data;
  };
  const pageSchema = object({ page: { type: 'integer', minimum: 1, default: 1 }, take: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, sortField: { type: 'string', enum: ['id', 'email', 'name', 'created_at', 'last_login', 'count_login'] }, sortOrder: { type: 'integer', enum: [1, -1] }, email: { type: 'string', maxLength: 254 }, name: { type: 'string', maxLength: 120 } });
  const paging = (q: any) => ({ skip: (q.page - 1) * q.take, take: q.take });
  app.get('/api/projects', { preHandler: admin, schema: { querystring: pageSchema } }, async (req: any) => {
    const where = { user_id: req.admin.id, ...(req.query.name ? { name: { contains: req.query.name, mode: 'insensitive' as const } } : {}) };
    const [data, total] = await db.$transaction([db.project.findMany({ where, ...paging(req.query), orderBy: { id: 'asc' } }), db.project.count({ where })]);
    return { data: data.map(p => safeProject(p, config)), total };
  });
  app.post('/api/projects', { preHandler: admin, schema: { body: object(projectProperties, ['name', 'redirect_url']) } }, async (req: any, reply) => {
    const input = { is_password_active: true, ...req.body };
    const data = validateProject(input);
    const p = await db.project.create({ data: { ...data, user_id: req.admin.id, Role: { create: [{ name: 'Admin', is_default: false }, { name: 'User', is_default: true }] } } });
    return reply.code(201).send(safeProject(p, config));
  });
  app.get('/api/projects/:id', { preHandler: admin }, async (req: any) => safeProject(await owned(req), config));
  app.patch('/api/projects/:id', { preHandler: admin, schema: { body: object(projectProperties) } }, async (req: any) => {
    const p = await owned(req);
    const data = validateProject(req.body, { ...p, ...(req.body.google_secret_id === '' ? { google_secret_id: p.google_secret_id } : {}) });
    return safeProject(await db.project.update({ where: { id: p.id }, data }), config);
  });
  app.delete('/api/projects/:id', { preHandler: admin }, async (req: any) => {
    const p = await owned(req);
    return db.$transaction(async tx => {
      assert(await tx.people.count({ where: { project_id: p.id } }) === 0 && await tx.permission.count({ where: { project_id: p.id } }) === 0, 409, 'Project contains users or permissions; export and remove them first');
      await tx.securityToken.deleteMany({ where: { tenantId: p.id } });
      await tx.magicToken.deleteMany({ where: { project_id: p.id } });
      await tx.role.deleteMany({ where: { project_id: p.id } });
      await tx.project.delete({ where: { id: p.id } }); return { message: 'Project deleted' };
    });
  });
  registerAuthorizationRoutes(app, db, { admin, owned });
  for (const resource of ['people']) {
    const model = (client: any) => client[resource === 'roles' ? 'role' : resource === 'permissions' ? 'permission' : 'people'];
    const prefix = `/api/${resource}/:tenant_code`;
    const selected = resource === 'people' ? { id: true, email: true, firstname: true, surname: true, image: true, verified: true, last_login: true, count_login: true, created_at: true, role: { select: { id: true, name: true } }, is_provider: true, provider: true } : undefined;
    app.get(prefix, { preHandler: admin, schema: { querystring: pageSchema } }, async (req: any) => {
      const p = await owned(req, true);
      const filter = resource === 'people' ? 'email' : 'name';
      const allowedSort = resource === 'people' ? ['id', 'email', 'created_at', 'last_login', 'count_login'] : ['id', 'name'];
      assert(!req.query.sortField || allowedSort.includes(req.query.sortField), 400, 'Invalid sort field');
      const where = { project_id: p.id, ...(req.query[filter] ? { [filter]: { contains: req.query[filter], mode: 'insensitive' } } : {}) };
      const [data, total] = await db.$transaction([model(db).findMany({ where, select: selected, ...paging(req.query), orderBy: { [req.query.sortField || 'id']: req.query.sortOrder === -1 ? 'desc' : 'asc' } }), model(db).count({ where })]);
      return { data, total };
    });
    app.get(`${prefix}/:id`, { preHandler: admin }, async (req: any) => {
      const p = await owned(req, true);
      const result = await model(db).findFirst({ where: { id: Number(req.params.id), project_id: p.id }, select: selected });
      assert(result, 404, 'Record not found'); return result;
    });
  }
  const cleanup = setInterval(() => { void db.securityToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => app.log.warn('Expired token cleanup failed')); }, 15 * 60 * 1000);
  cleanup.unref();
  app.addHook('onClose', async () => clearInterval(cleanup));
  return app;
}
