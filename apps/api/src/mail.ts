import nodemailer from 'nodemailer';
import type { Config } from './config';

export interface Mailer { send(to: string, subject: string, url: string): Promise<void> }
export function createMailer(config: Config): Mailer {
  const transport = config.smtpHost ? nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465, auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 }) : null;
  return { async send(to, subject, url) {
    if (!transport) throw new Error('SMTP is not configured');
    await transport.sendMail({ from: config.smtpFrom, to, subject, text: `${subject}\n\n${url}\n\nThis link expires in 15 minutes and can be used once.` });
  } };
}
