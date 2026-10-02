import { ConfigModule, ConfigService } from '@nestjs/config';

export const mailerConfig = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const rawHost =
      configService.get<string>('BREVO_SMTP_HOST') ||
      configService.get<string>('SMTP_HOST') ||
      configService.get<string>('MAILHOG_URL') ||
      'smtp-relay.brevo.com';

    // Bersihkan host jika terdapat prefix seperti "://" atau "https://"
    const host = rawHost.replace(/^(?:https?:\/\/|:\/\/)/, '').trim();

    const port =
      Number(
        configService.get<number>('BREVO_SMTP_PORT') ||
          configService.get<number>('SMTP_PORT'),
      ) || 587;

    const user =
      configService.get<string>('BREVO_SMTP_USER') ||
      configService.get<string>('SMTP_USER') ||
      configService.get<string>('MAIL_USER');

    const pass =
      configService.get<string>('BREVO_SMTP_PASS') ||
      configService.get<string>('SMTP_PASS') ||
      configService.get<string>('MAIL_PASS');

    const fromEmail =
      configService.get<string>('BREVO_FROM_EMAIL') ||
      configService.get<string>('MAIL_FROM') ||
      user ||
      'noreply@mamabear.com';

    return {
      transport: {
        host,
        port,
        secure: port === 465,
        ...(user && pass ? { auth: { user, pass } } : {}),
      },
      defaults: {
        from: `"MamaBear" <${fromEmail}>`,
      },
    };
  },
};
