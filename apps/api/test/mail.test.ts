import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer } from '../src/mail';
import type { Config } from '../src/config';
test('SMTP delivery reaches the local inbox with the exact confirmation link', { skip: !process.env.TEST_SMTP_PORT }, async () => {
  const url=`http://localhost:4200/auth/email/verify?token=synthetic-${Date.now()}`;
  const mailer=createMailer({smtpHost:'127.0.0.1',smtpPort:Number(process.env.TEST_SMTP_PORT),smtpFrom:'Rouge One <noreply@example.invalid>'} as Config);
  await mailer.send('smtp-test@example.invalid','Verify your email',url);
  const endpoint=`http://127.0.0.1:${process.env.TEST_MAILPIT_PORT || '8026'}/api/v1`;
  const messages=await (await fetch(`${endpoint}/messages`)).json() as any;
  assert(messages.messages.length>0);
  const message=await (await fetch(`${endpoint}/message/${messages.messages[0].ID}`)).json() as any;
  assert(message.Text.includes(url)); assert.equal(message.To[0].Address,'smtp-test@example.invalid');
});
