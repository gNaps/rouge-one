import dotenv from 'dotenv';
import path from 'node:path';

export interface Config {
  databaseUrl: string; publicUrl: string; port: number; host: string;
  adminKey: string; peopleKey: string; bootstrapToken: string; production: boolean;
  smtpHost?: string; smtpPort: number; smtpUser?: string; smtpPassword?: string; smtpFrom: string;
  googleClientId?: string; googleClientSecret?: string; trustProxy: boolean;
}

export function loadConfig(): Config {
  dotenv.config({ path: process.env.CONFIG_FILE || path.resolve(__dirname, '../../../.env.local') });
  const required = (key: string) => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing configuration: ${key}. Run pnpm run setup.`);
    return value;
  };
  const publicUrl = new URL(required('PUBLIC_URL'));
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) throw new Error('PUBLIC_URL must be an HTTP(S) origin');
  const database = new URL(required('DATABASE_URL'));
  if (!['postgresql:', 'postgres:'].includes(database.protocol) || database.searchParams.has('schema') && database.searchParams.get('schema') !== 'public') throw new Error('Use PostgreSQL with a dedicated public schema');
  const production = process.env.NODE_ENV === 'production';
  if (production && publicUrl.protocol !== 'https:') throw new Error('Production requires an HTTPS PUBLIC_URL');
  const adminKey = required('ADMIN_JWT_SECRET');
  const peopleKey = required('PEOPLE_JWT_SECRET');
  if (adminKey.length < 32 || peopleKey.length < 32 || adminKey === peopleKey) throw new Error('Use distinct JWT secrets of at least 32 characters');
  const port = Number(process.env.PORT || 3000), smtpPort = Number(process.env.SMTP_PORT || 1025);
  if (![port, smtpPort].every(n => Number.isInteger(n) && n > 0 && n < 65536)) throw new Error('Invalid PORT or SMTP_PORT');
  if (!!process.env.GOOGLE_CLIENT_ID !== !!process.env.GOOGLE_CLIENT_SECRET) throw new Error('Configure both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  return {
    databaseUrl: required('DATABASE_URL'), publicUrl: publicUrl.origin, port,
    host: process.env.HOST || '127.0.0.1', adminKey, peopleKey,
    bootstrapToken: required('BOOTSTRAP_TOKEN'), production, smtpHost: process.env.SMTP_HOST || undefined,
    smtpPort, smtpUser: process.env.SMTP_USER || undefined, smtpPassword: process.env.SMTP_PASSWORD || undefined,
    smtpFrom: process.env.SMTP_FROM || 'Rouge One <noreply@example.invalid>',
    googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    trustProxy: process.env.TRUST_PROXY === 'true',
  };
}
