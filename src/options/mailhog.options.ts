import 'dotenv/config';
import { MailerOptions } from '@nestjs-modules/mailer';

export const MailHogOptions: MailerOptions = {
  defaults: {
    from: '"Mama Beruang" <noreply@mamabear.com>',
    to: 'test@mailhog.local',
  },
  transport: {
    host: process.env.MAILHOG_URL,
    port: 1025,
    secure: false,
  },
};
