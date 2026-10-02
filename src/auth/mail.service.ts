import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailService: MailerService) {}

  async sendVerificationEmail(email: string, token: string) {
    const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:8000';
    const verifyUrl = `${backendUrl}/auth/verify-email/${token}`;
    
    await this.mailService.sendMail({
      to: email,
      subject: 'Verifikasi Email Akun MamaBear',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Halo Mama!</h2>
          <p>Terima kasih telah mendaftar di MamaBear. Silakan klik tombol di bawah ini untuk memverifikasi akun Anda:</p>
          <a href="${verifyUrl}" style="background-color: #E25B7B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verifikasi Akun</a>
          <p style="margin-top: 16px; font-size: 12px; color: #777;">Atau buka tautan berikut: <a href="${verifyUrl}">${verifyUrl}</a></p>
        </div>
      `,
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
