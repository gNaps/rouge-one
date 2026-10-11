import { defineConfig } from '@playwright/test';
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.includes('test')) throw new Error('Browser tests require a disposable TEST_DATABASE_URL with test in the database name');
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 45000, globalSetup: './tests/global-setup.ts',
  use: { baseURL: 'http://localhost:4200', trace: 'retain-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: [
    { command: 'node apps/api/node_modules/tsx/dist/cli.mjs apps/api/src/app.ts', url: 'http://localhost:3000/api/health', reuseExistingServer: false, env: { ...process.env, DATABASE_URL: databaseUrl, PUBLIC_URL: 'http://localhost:4200', HOST: '127.0.0.1', PORT: '3000', NODE_ENV: 'development', ADMIN_JWT_SECRET: 'browser-test-admin-key-01234567890123456789', PEOPLE_JWT_SECRET: 'browser-test-people-key-01234567890123456789', BOOTSTRAP_TOKEN: 'browser-setup-token&with+symbols=#', SMTP_HOST: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' } },
    { command: 'node scripts/serve-test.mjs', url: 'http://localhost:4200', reuseExistingServer: false },
  ],
});
