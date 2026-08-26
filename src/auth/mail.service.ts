import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailService: MailerService) {}

  async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${process.env.BACKEND_URL}/auth/verify-email?token=${token}`;
    await this.mailService.sendMail({
      to: email,
      subject: 'Please verify your email',
      text: `Klik link berikut untuk verify email anda: ${verifyUrl}`,
    });
  }

  async confirmEmailVerified(email: string, userName: string) {
    await this.mailService.sendMail({
      to: email,
      subject: 'Selamat datang ke rumah Mamabear!',
      text: `${userName}, selamat datang ke rumah Mamabear!`,
    });
  }

  async sendForgotPasswordMail(email: string, token: string) {
    const resetUrl = `${process.env.BACKEND_URL}/auth/reset-password?token=${token}`;

    await this.mailService.sendMail({
      to: email,
      subject: 'Reset password request',
      text: `Klik link berikut untuk verify email anda: ${resetUrl}`,
    });
  }

  async orderConfirmationEmail(email: string, orderId: string) {
    const orderUrl = `${process.env.BACKEND_URL}/orders/${orderId}`;
    await this.mailService.sendMail({
      to: email,
      subject: 'Order Confirmation',
      text: `Pesanan Anda sudah di konfirmasi`,
      html: `<p>Pesanan Anda sudah di konfirmasi.</p><p><a href="${orderUrl}">Lihat detail pesanan</a></p>`,
    });
  }
}
