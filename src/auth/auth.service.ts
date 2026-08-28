import { PinoLogger } from 'pino-nestjs';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginUserDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { MailService } from './mail.service';
import { JwtService } from '@nestjs/jwt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response } from 'express';
import { ServiceResult } from '@/common/ServiceResult';
import { Role } from '@/generated/prisma';

class LoginReturns {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(dto: LoginUserDto, res: Response): Promise<ServiceResult<LoginReturns>> {
    try {
      const user = await this.repo.findEmail(dto.email);

      if (!user) {
        this.logger.warn({
          message: 'Login attempt with non-existent email',
          endpoint: 'POST /auth/login',
          email: dto.email,
          status: 'failure',
        });
        throw new BadRequestException('Email not found');
      }

      const isValid = await bcrypt.compare(dto.password, user.hashedPassword);

      if (!isValid) {
        this.logger.warn({
          message: 'Invalid password provided',
          endpoint: 'POST /auth/login',
          email: dto.email,
          status: 'failure',
        });
        throw new BadRequestException('Invalid password');
      }

      if (!user.isVerified) {
        this.logger.warn({
          message: 'Login attempt with unverified account',
          endpoint: 'POST /auth/login',
          email: dto.email,
          status: 'failure',
        });
        throw new BadRequestException('Your account is not verified');
      }

      if ((user as any).isBlocked) {
        this.logger.warn({
          message: 'Login attempt with blocked account',
          endpoint: 'POST /auth/login',
          email: dto.email,
          userId: user.id,
          status: 'failure',
        });
        throw new BadRequestException('Your account has been blocked');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      });

      const refreshToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      });
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await this.repo.update(
        { id: user.id },
        {
          refreshToken: hashedRefreshToken,
          refreshTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
      );

      this.logger.info({
        message: 'User login successful',
        endpoint: 'POST /auth/login',
        email: dto.email,
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Login successful`,
        data: { accessToken, refreshToken }
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Login error',
        endpoint: 'POST /auth/login',
        email: dto.email,
        status: 'error',
        error: error.message,
      });
      throw new Error('An error occurred while logging in');
    }
  }

  async register(dto: RegisterUserDto): Promise<ServiceResult<null>> {
    try {
      const emailIsExist = await this.repo.findEmail(dto.email);
      if (emailIsExist) {
        this.logger.warn({
          message: 'Registration attempt with existing email',
          endpoint: 'POST /auth/register',
          email: dto.email,
          status: 'failure',
        });
        throw new BadRequestException('Email already exist');
      }

      const hashed = await bcrypt.hash(dto.password, 10);
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60);

      const user = await this.repo.create({
        name: dto.name,
        email: dto.email,
        hashedPassword: hashed,
        phone: dto.phone,
        verificationToken,
        verificationTokenExpiry,
      });

      // send email
      await this.mailService.sendVerificationEmail(
        dto.email,
        verificationToken,
      );

      this.logger.info({
        message: 'User registration successful',
        endpoint: 'POST /auth/register',
        email: dto.email,
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Register success, check your email to verify`,
        data: null,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Registration error',
        endpoint: 'POST /auth/register',
        email: dto.email,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<ServiceResult<null>> {
    try {
      const user = await this.repo.findUserByVerificationToken(token);

      if (!user) {
        this.logger.warn({
          message: 'Email verification with invalid token',
          endpoint: 'GET /auth/verify-email',
          status: 'failure',
        });
        throw new BadRequestException('Invalid token');
      }

      if (
        !user.verificationTokenExpiry ||
        user.verificationTokenExpiry < new Date()
      ) {
        this.logger.warn({
          message: 'Email verification with expired token',
          endpoint: 'GET /auth/verify-email',
          email: user.email,
          status: 'failure',
        });
        throw new BadRequestException('Token expired');
      }

      await this.repo.update(
        { id: user.id },
        {
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      );

      this.logger.info({
        message: 'Email verified successfully',
        endpoint: 'GET /auth/verify-email',
        email: user.email,
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Email verified successfully`,
        data: null,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Email verification error',
        endpoint: 'GET /auth/verify-email',
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<ServiceResult<LoginReturns>> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.repo.findUserById(payload.sub);

      if (!user) {
        this.logger.warn({
          message: 'Refresh token attempt with non-existent user',
          endpoint: 'POST /auth/refresh',
          userId: payload.sub,
          status: 'failure',
        });
        throw new UnauthorizedException('User not found');
      }

      if (!user.refreshToken) {
        this.logger.warn({
          message: 'Refresh token attempt without stored token',
          endpoint: 'POST /auth/refresh',
          userId: user.id,
          status: 'failure',
        });
        throw new UnauthorizedException('Refresh token not found');
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isMatch) {
        this.logger.warn({
          message: 'Invalid refresh token provided',
          endpoint: 'POST /auth/refresh',
          userId: user.id,
          status: 'failure',
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
        await this.repo.update(
          { id: user.id },
          { refreshToken: null, refreshTokenExpiry: null },
        );
        this.logger.warn({
          message: 'Refresh token expired',
          endpoint: 'POST /auth/refresh',
          userId: user.id,
          status: 'failure',
        });
        throw new UnauthorizedException('Refresh token expired');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
      };

      const newRefreshToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      });

      const newAccessToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      });

      const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

      await this.repo.update(
        { id: user.id },
        {
          refreshToken: hashedRefreshToken,
          refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      );
      this.logger.info({
        message: 'Token refresh successful',
        endpoint: 'POST /auth/refresh',
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Token refreshed successfully`,
        data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Token refresh error',
        endpoint: 'POST /auth/refresh',
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async logout(userId: string, res: Response): Promise<ServiceResult<null>> {
    try {
      const user = await this.repo.findUserById(userId);

      if (!user) {
        this.logger.warn({
          message: 'Logout attempt for non-existent user',
          endpoint: 'POST /auth/logout',
          userId,
          status: 'failure',
        });
        throw new BadRequestException('User not found');
      }

      res.clearCookie('refreshToken');
      res.clearCookie('accessToken');

      await this.repo.update(
        { id: user.id },
        {
          refreshToken: null,
          refreshTokenExpiry: null,
        },
      );

      this.logger.info({
        message: 'User logout successful',
        endpoint: 'POST /auth/logout',
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Logout success`,
        data: null,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Logout error',
        endpoint: 'POST /auth/logout',
        userId,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ServiceResult<null>> {
    try {
      const user = await this.repo.findEmail(dto.email);

      if (!user) {
        this.logger.warn({
          message: 'Forgot password attempt with non-existent email',
          endpoint: 'POST /auth/forgot-password',
          email: dto.email,
          status: 'failure',
        });
        throw new BadRequestException('User not found');
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 15);

      await this.repo.update(
        { id: user.id },
        {
          resetToken,
          resetTokenExpiry,
        },
      );

      // send email
      await this.mailService.sendForgotPasswordMail(dto.email, resetToken);

      this.logger.info({
        message: 'Forgot password request processed',
        endpoint: 'POST /auth/forgot-password',
        email: dto.email,
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Check your email to reset password`,
        data: null,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Forgot password error',
        endpoint: 'POST /auth/forgot-password',
        email: dto.email,
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async resetPassword(
    token: string,
    dto: ResetPasswordDto,
  ): Promise<ServiceResult<null>> {
    try {
      const user = await this.repo.findUserByResetToken(token);

      if (!user) {
        this.logger.warn({
          message: 'Password reset with invalid token',
          endpoint: 'POST /auth/reset-password',
          status: 'failure',
        });
        throw new BadRequestException('Invalid token');
      }

      if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        await this.repo.update(
          { id: user.id },
          { resetToken: null, resetTokenExpiry: null },
        );
        this.logger.warn({
          message: 'Password reset with expired token',
          endpoint: 'POST /auth/reset-password',
          email: user.email,
          status: 'failure',
        });
        throw new BadRequestException('Reset token expired');
      }

      const hashed = await bcrypt.hash(dto.password, 10);

      await this.repo.update(
        { id: user.id },
        {
          hashedPassword: hashed,
          refreshToken: null,
          refreshTokenExpiry: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
      );

      this.logger.info({
        message: 'Password reset successful',
        endpoint: 'POST /auth/reset-password',
        email: user.email,
        userId: user.id,
        status: 'success',
      });

      return {
        success: true,
        message: `Password reset success`,
        data: null,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Password reset error',
        endpoint: 'POST /auth/reset-password',
        status: 'error',
        error: error.message,
      });
      throw error;
    }
  }

  async createAdmin(dto: RegisterUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.repo.create({
      name: dto.name,
      email: dto.email,
      hashedPassword: hashed,
      phone: dto.phone,
      role: Role.ADMIN,
      isVerified: true,
    });
  }

  async createUser(dto: RegisterUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.repo.create({
      name: dto.name,
      email: dto.email,
      hashedPassword: hashed,
      phone: dto.phone,
      role: Role.USER,
      isVerified: true,
    });
  }
}
